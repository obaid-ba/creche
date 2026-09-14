"""Serializers for authentication and account management.

All validation that matters happens here, server-side. The Zod schemas in
the frontend are a UX affordance only (docs/authentication.md 6).
"""
from __future__ import annotations

from django.contrib.auth import authenticate, password_validation
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.audit.models import AuditAction
from apps.audit.services import record as record_audit

from .access_codes import ChildAccessCode, fold_name
from .models import Guardianship, ParentProfile, Relationship, Role, User

# One message for every credential failure. Distinguishing "unknown email"
# from "wrong password" would let an attacker enumerate which parents have
# accounts at this nursery.
INVALID_CREDENTIALS = _("Identifiants invalides.")

# Likewise, every access-code failure (unknown, expired, claimed, revoked)
# returns this single message, so the endpoint cannot be used as an oracle
# for which codes exist (docs/authentication.md 4.4).
INVALID_CODE = _("Code d'accès ou prénom incorrect.")


class ParentCodeLoginSerializer(serializers.Serializer):
    """Sign a parent in with their access code and their child's name.

    Parents never register themselves and never choose a password: staff
    create the account from the paper enrolment form, and this is the only
    thing the parent ever has to do. See `accounts/access_codes.py` for why
    the code is sized the way it is.

    Every failure returns the same message. A wrong code, a revoked one, a
    locked one and a right code with the wrong child must be
    indistinguishable, or the endpoint tells an attacker which codes exist.
    """

    access_code = serializers.CharField(max_length=32)
    child_name = serializers.CharField(max_length=80)

    def validate(self, attrs):
        request = self.context.get("request")
        code = ChildAccessCode.resolve(attrs["access_code"])

        if code is None:
            record_audit(action=AuditAction.CODE_CLAIM_FAILED, request=request)
            raise serializers.ValidationError(INVALID_CODE)

        if fold_name(attrs["child_name"]) != fold_name(code.child.first_name):
            # Counted against the code, not just the caller's address: a
            # standing credential is worth grinding from many addresses.
            code.register_failure()
            record_audit(action=AuditAction.CODE_CLAIM_FAILED, request=request)
            raise serializers.ValidationError(INVALID_CODE)

        parent = code.parent
        if parent is None or not parent.user.is_active:
            record_audit(action=AuditAction.CODE_CLAIM_FAILED, request=request)
            raise serializers.ValidationError(INVALID_CODE)

        attrs["code"] = code
        return attrs

    def save(self, **kwargs):
        code: ChildAccessCode = self.validated_data["code"]
        code.register_success()
        # `actor`, not `user`: anything else lands in the JSON metadata
        # column, and a User instance is not serialisable.
        record_audit(
            action=AuditAction.CODE_CLAIMED,
            request=self.context.get("request"),
            actor=code.parent.user,
            child=code.child,
        )
        return code.parent.user


class ChildSummarySerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    first_name = serializers.CharField(read_only=True)
    last_name = serializers.CharField(read_only=True)
    photo_url = serializers.SerializerMethodField()

    def get_photo_url(self, obj) -> str | None:
        if not obj.photo:
            return None
        request = self.context.get("request")
        url = obj.photo.url
        return request.build_absolute_uri(url) if request else url


class CurrentUserSerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()

    # Role-specific profile fields, flattened onto the user so the profile
    # screen is one request and one form rather than two of each.
    address = serializers.CharField(
        source="parent_profile.address", required=False, allow_blank=True
    )
    emergency_phone = serializers.CharField(
        source="parent_profile.emergency_phone", required=False,
        allow_blank=True, max_length=30,
    )
    job_title = serializers.CharField(
        source="staff_profile.job_title", required=False,
        allow_blank=True, read_only=True,
    )

    class Meta:
        model = User
        fields = (
            "id", "email", "first_name", "last_name",
            "phone", "role", "children",
            "address", "emergency_phone", "job_title",
        )
        read_only_fields = (
            "id", "email", "role", "children",
            "job_title",
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # A staff member has no parent profile and vice versa; omit the
        # fields that do not apply rather than returning nulls the form
        # would then have to special-case.
        if not instance.is_parent:
            data.pop("address", None)
            data.pop("emergency_phone", None)
        else:
            data.pop("job_title", None)
        return data

    def update(self, instance, validated_data):
        """Write through to the parent profile as well as the user."""
        profile_data = validated_data.pop("parent_profile", {})

        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()

        if profile_data and instance.is_parent:
            profile = instance.parent_profile
            for field, value in profile_data.items():
                setattr(profile, field, value)
            profile.save()

        return instance

    def get_children(self, obj) -> list[dict]:
        """The parent's own children.

        Deliberately empty for staff and admin. ``visible_to`` would return
        every child in the nursery for them, which is both semantically
        wrong here (this field means "my children") and unbounded - it
        would make the login response grow with the size of the nursery.
        Staff browse children through the paginated /api/children/ list.
        """
        if not obj.is_parent:
            return []

        from apps.children.models import Child

        children = Child.objects.visible_to(obj)
        return ChildSummarySerializer(
            children, many=True, context=self.context
        ).data


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        request = self.context.get("request")
        email = attrs["email"].lower().strip()

        user = authenticate(request, username=email, password=attrs["password"])

        if user is None:
            record_audit(
                action=AuditAction.LOGIN_FAILED,
                request=request,
                email=email,
                reason="invalid_credentials",
            )
            raise serializers.ValidationError(INVALID_CREDENTIALS)

        # ``authenticate`` already rejects inactive users via the default
        # backend, but this is asserted explicitly so a future custom
        # backend cannot silently let a deactivated account back in.
        if not user.is_active:
            record_audit(
                action=AuditAction.LOGIN_FAILED,
                request=request,
                email=email,
                reason="inactive",
            )
            raise serializers.ValidationError(INVALID_CREDENTIALS)

        attrs["user"] = user
        return attrs


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_current_password(self, value: str) -> str:
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Mot de passe actuel incorrect.")
        return value

    def validate_new_password(self, value: str) -> str:
        password_validation.validate_password(value, self.context["request"].user)
        return value

    def save(self, **kwargs) -> User:
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        record_audit(
            action=AuditAction.PASSWORD_CHANGED,
            request=self.context.get("request"),
            actor=user,
            obj=user,
        )
        return user


