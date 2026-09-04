"""Serializers for authentication and account management.

All validation that matters happens here, server-side. The Zod schemas in
the frontend are a UX affordance only (docs/authentication.md 6).
"""
from __future__ import annotations

from django.contrib.auth import authenticate, password_validation
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.audit.models import AuditAction
from apps.audit.services import record as record_audit

from .access_codes import ChildAccessCode
from .models import Guardianship, ParentProfile, Relationship, Role, User

# One message for every credential failure. Distinguishing "unknown email"
# from "wrong password" would let an attacker enumerate which parents have
# accounts at this nursery.
INVALID_CREDENTIALS = "Identifiants invalides."

# Likewise, every access-code failure (unknown, expired, claimed, revoked)
# returns this single message, so the endpoint cannot be used as an oracle
# for which codes exist (docs/authentication.md 4.4).
INVALID_CODE = "Ce code d'accès est invalide, expiré ou déjà utilisé."


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

    class Meta:
        model = User
        fields = (
            "id", "email", "first_name", "last_name",
            "phone", "role", "children",
        )
        read_only_fields = ("id", "email", "role", "children")

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


class ParentClaimSerializer(serializers.Serializer):
    """First-time parent activation using a child access code.

    Creates the user, the parent profile and the guardianship in one
    transaction, and consumes the code. Any failure rolls all of it back,
    so there is no path to a half-created parent holding a spent code
    (docs/authentication.md 4.4).
    """

    access_code = serializers.CharField(max_length=32)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    first_name = serializers.CharField(max_length=80)
    last_name = serializers.CharField(max_length=80)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    relationship = serializers.ChoiceField(
        choices=Relationship.choices, default=Relationship.GUARDIAN
    )

    def validate_password(self, value: str) -> str:
        password_validation.validate_password(value)
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        code = ChildAccessCode.resolve(attrs["access_code"])

        if code is None:
            record_audit(
                action=AuditAction.CODE_CLAIM_FAILED,
                request=request,
                email=attrs["email"].lower().strip(),
            )
            # Attached to the field so the form can highlight it, but with
            # a message that reveals nothing about why it failed.
            raise serializers.ValidationError({"access_code": INVALID_CODE})

        email = attrs["email"].lower().strip()
        existing = User.objects.filter(email=email).first()

        if existing is not None:
            # An email already in use is only acceptable when it belongs to
            # a parent who proves they own it with the right password -
            # otherwise this endpoint would let anyone with a code attach
            # a child to someone else's account.
            if existing.role != Role.PARENT or not existing.check_password(
                attrs["password"]
            ):
                raise serializers.ValidationError(
                    {"email": "Cette adresse e-mail est déjà utilisée."}
                )
            attrs["existing_user"] = existing

        attrs["code"] = code
        attrs["email"] = email
        return attrs

    @transaction.atomic
    def save(self, **kwargs) -> User:
        request = self.context.get("request")
        code: ChildAccessCode = self.validated_data["code"]
        existing: User | None = self.validated_data.get("existing_user")

        if existing is not None:
            user = existing
            parent_profile = user.parent_profile
        else:
            user = User.objects.create_user(
                email=self.validated_data["email"],
                password=self.validated_data["password"],
                first_name=self.validated_data["first_name"],
                last_name=self.validated_data["last_name"],
                phone=self.validated_data.get("phone", ""),
                role=Role.PARENT,
            )
            parent_profile = ParentProfile.objects.create(user=user)

        guardianship, created = Guardianship.objects.get_or_create(
            parent=parent_profile,
            child=code.child,
            defaults={
                "relationship": self.validated_data["relationship"],
                # The first guardian to claim becomes the primary contact.
                "is_primary": not Guardianship.objects.filter(
                    child=code.child, is_primary=True, revoked_at__isnull=True
                ).exists(),
            },
        )
        if not created and guardianship.revoked_at is not None:
            # Re-claiming after a revocation restores the link.
            guardianship.revoked_at = None
            guardianship.save(update_fields=["revoked_at", "updated_at"])

        code.claimed_at = timezone.now()
        code.claimed_by = parent_profile
        code.save(update_fields=["claimed_at", "claimed_by", "updated_at"])

        record_audit(
            action=AuditAction.CODE_CLAIMED,
            request=request,
            actor=user,
            obj=code,
            child=code.child,
        )
        return user


class LinkChildSerializer(serializers.Serializer):
    """An already-authenticated parent adding another child."""

    access_code = serializers.CharField(max_length=32)
    relationship = serializers.ChoiceField(
        choices=Relationship.choices, default=Relationship.GUARDIAN
    )

    def validate_access_code(self, value: str):
        code = ChildAccessCode.resolve(value)
        if code is None:
            record_audit(
                action=AuditAction.CODE_CLAIM_FAILED,
                request=self.context.get("request"),
            )
            raise serializers.ValidationError(INVALID_CODE)
        return code

    @transaction.atomic
    def save(self, **kwargs) -> Guardianship:
        request = self.context["request"]
        code: ChildAccessCode = self.validated_data["access_code"]
        parent_profile = request.user.parent_profile

        guardianship, created = Guardianship.objects.get_or_create(
            parent=parent_profile,
            child=code.child,
            defaults={
                "relationship": self.validated_data["relationship"],
                "is_primary": not Guardianship.objects.filter(
                    child=code.child, is_primary=True, revoked_at__isnull=True
                ).exists(),
            },
        )
        if not created and guardianship.revoked_at is not None:
            guardianship.revoked_at = None
            guardianship.save(update_fields=["revoked_at", "updated_at"])

        code.claimed_at = timezone.now()
        code.claimed_by = parent_profile
        code.save(update_fields=["claimed_at", "claimed_by", "updated_at"])

        record_audit(
            action=AuditAction.CODE_CLAIMED,
            request=request,
            obj=code,
            child=code.child,
        )
        return guardianship
