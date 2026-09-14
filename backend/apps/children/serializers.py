"""Child serializers.

Two representations, deliberately separated by audience: staff see medical
and internal notes, parents do not. Keeping them as distinct classes means
a field cannot leak by being added to a shared ``fields`` list
(docs/database.md 11).
"""
from __future__ import annotations

from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.accounts.models import Relationship, User
from common.age import AgeGroup, age_display, age_group_for, age_in_months

from .models import Child, ChildStatus


class AgeGroupField(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()


class BaseChildSerializer(serializers.ModelSerializer):
    """Fields common to every audience.

    Age is computed on read and never stored (docs/database.md 4.1).
    """

    age_months = serializers.SerializerMethodField()
    age_display = serializers.SerializerMethodField()
    age_group = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()
    full_name = serializers.CharField(read_only=True)

    def get_age_months(self, obj: Child) -> int:
        return age_in_months(obj.date_of_birth)

    def get_age_display(self, obj: Child) -> str:
        return age_display(obj.date_of_birth)

    def get_age_group(self, obj: Child) -> dict[str, str]:
        key = age_group_for(obj.date_of_birth)
        return {"key": key, "label": AgeGroup(key).label}

    def get_photo_url(self, obj: Child) -> str | None:
        if not obj.photo:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.photo.url) if request else obj.photo.url


class ChildParentSerializer(BaseChildSerializer):
    """What a parent may see about their own child.

    Excludes `medical_notes` and the internal `notes`, which are staff
    working records rather than information for the family.
    """

    class Meta:
        model = Child
        fields = (
            "id", "first_name", "last_name", "full_name",
            "date_of_birth", "age_months", "age_display", "age_group",
            "gender", "photo_url", "allergies", "status",
        )
        read_only_fields = fields


class ChildListSerializer(BaseChildSerializer):
    """Compact row for the staff children list."""

    class Meta:
        model = Child
        fields = (
            "id", "first_name", "last_name", "full_name",
            "date_of_birth", "age_months", "age_display", "age_group",
            "gender", "photo_url", "status", "allergies",
        )
        read_only_fields = fields


class ChildDetailSerializer(BaseChildSerializer):
    """Full staff view, including read-write fields."""

    guardians = serializers.SerializerMethodField()
    has_active_access_code = serializers.SerializerMethodField()

    class Meta:
        model = Child
        fields = (
            "id", "first_name", "last_name", "full_name",
            "date_of_birth", "age_months", "age_display", "age_group",
            "gender", "photo", "photo_url", "registration_date",
            "allergies", "medical_notes", "notes",
            "status", "archived_at", "guardians", "has_active_access_code",
            "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "full_name", "age_months", "age_display", "age_group",
            "photo_url", "status", "archived_at", "guardians",
            "has_active_access_code", "created_at", "updated_at",
        )

    def get_guardians(self, obj: Child) -> list[dict]:
        # Uses the prefetched rows the viewset supplies, so this does not
        # become an N+1 across a page of children.
        return [
            {
                "id": str(link.id),
                "parent_id": str(link.parent_id),
                "first_name": link.parent.user.first_name,
                "last_name": link.parent.user.last_name,
                "email": link.parent.user.email,
                "phone": link.parent.user.phone,
                "relationship": link.relationship,
                "is_primary": link.is_primary,
            }
            for link in obj.guardianships.all()
            if link.revoked_at is None
        ]

    def get_has_active_access_code(self, obj: Child) -> bool:
        """Codes no longer expire or get spent, so live means not revoked."""
        return any(code.revoked_at is None for code in obj.access_codes.all())

    def validate_date_of_birth(self, value):
        # Mirrors the database CHECK constraint so the caller gets a clean
        # 400 with a French message instead of a 409 from the constraint.
        if value > timezone.localdate():
            raise serializers.ValidationError(
                _("La date de naissance ne peut pas être dans le futur.")
            )
        return value


class ChildWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Child
        fields = (
            "first_name", "last_name", "date_of_birth", "gender", "photo",
            "registration_date", "allergies", "medical_notes", "notes",
        )

    def validate_date_of_birth(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError(
                _("La date de naissance ne peut pas être dans le futur.")
            )
        return value

    def validate_first_name(self, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Le prénom est requis.")
        return cleaned

    def validate_last_name(self, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Le nom est requis.")
        return cleaned


class AccessCodeResponseSerializer(serializers.Serializer):
    """The one and only time the plaintext code is exposed."""

    code = serializers.CharField(read_only=True)
    hint = serializers.CharField(read_only=True)
    parent_id = serializers.UUIDField(read_only=True)
    parent_name = serializers.CharField(read_only=True)
    child_name = serializers.CharField(read_only=True)


class GuardianCreateSerializer(serializers.Serializer):
    """A parent, typed in by staff from the paper enrolment form.

    Everything here comes off the form the family handed in. The parent
    does not fill anything in themselves and never picks a password —
    they are handed a code and their child's first name.
    """

    #: Set when the family already has an account — a second child joining
    #: the nursery. Without it staff would create a duplicate parent and
    #: the family would end up with two logins and half their children
    #: behind each.
    parent_id = serializers.UUIDField(required=False, allow_null=True)

    first_name = serializers.CharField(max_length=80, required=False)
    last_name = serializers.CharField(max_length=80, required=False)
    relationship = serializers.ChoiceField(choices=Relationship.choices)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    # Optional, and only ever contact detail: it is not a login.
    email = serializers.EmailField(required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs.get("parent_id") is None:
            missing = {
                field: _("Ce champ est obligatoire.")
                for field in ("first_name", "last_name")
                if not attrs.get(field)
            }
            if missing:
                raise serializers.ValidationError(missing)
        return attrs

    def validate_email(self, value: str):
        cleaned = (value or "").strip().lower()
        if cleaned and User.objects.filter(email=cleaned).exists():
            raise serializers.ValidationError(
                _("Cette adresse e-mail est déjà utilisée.")
            )
        return cleaned


class ChildStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=ChildStatus.choices)


class AgeGroupCountSerializer(serializers.Serializer):
    """Age band with a live count, for the staff dashboard."""

    key = serializers.CharField(read_only=True)
    label = serializers.CharField(read_only=True)
    count = serializers.IntegerField(read_only=True)
