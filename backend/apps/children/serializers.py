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
        now = timezone.now()
        return any(
            code.claimed_at is None
            and code.revoked_at is None
            and code.expires_at > now
            for code in obj.access_codes.all()
        )

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


class GuardianLinkSerializer(serializers.Serializer):
    """Attach an existing parent account to a child."""

    email = serializers.EmailField()
    relationship = serializers.CharField(max_length=20)
    is_primary = serializers.BooleanField(default=False)

    def validate_email(self, value: str):
        from apps.accounts.models import Role, User

        user = User.objects.filter(email=value.lower().strip()).first()
        if user is None or user.role != Role.PARENT:
            raise serializers.ValidationError(
                _("Aucun compte parent ne correspond à cette adresse.")
            )
        return user


class AccessCodeResponseSerializer(serializers.Serializer):
    """The one and only time the plaintext code is exposed."""

    code = serializers.CharField(read_only=True)
    expires_at = serializers.DateTimeField(read_only=True)
    hint = serializers.CharField(read_only=True)


class ChildStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=ChildStatus.choices)


class AgeGroupCountSerializer(serializers.Serializer):
    """Age band with a live count, for the staff dashboard."""

    key = serializers.CharField(read_only=True)
    label = serializers.CharField(read_only=True)
    count = serializers.IntegerField(read_only=True)
