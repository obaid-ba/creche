"""Activity serializers (docs/api.md 8)."""
from __future__ import annotations

from rest_framework import serializers

from .models import Activity, ActivityCategory, ActivityParticipation, ActivityPhoto


class ActivityPhotoSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = ActivityPhoto
        fields = ("id", "image_url", "thumbnail_url", "caption", "order")
        read_only_fields = fields

    def _absolute(self, field) -> str | None:
        if not field:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(field.url) if request else field.url

    def get_image_url(self, obj) -> str | None:
        return self._absolute(obj.image)

    def get_thumbnail_url(self, obj) -> str | None:
        return self._absolute(obj.thumbnail or obj.image)


class ParticipantSerializer(serializers.ModelSerializer):
    child_id = serializers.UUIDField(source="child.id", read_only=True)
    first_name = serializers.CharField(source="child.first_name", read_only=True)
    last_name = serializers.CharField(source="child.last_name", read_only=True)

    class Meta:
        model = ActivityParticipation
        fields = ("id", "child_id", "first_name", "last_name", "note")
        read_only_fields = fields


class ActivitySerializer(serializers.ModelSerializer):
    photos = ActivityPhotoSerializer(many=True, read_only=True)
    participants = serializers.SerializerMethodField()
    participant_count = serializers.SerializerMethodField()
    category_label = serializers.SerializerMethodField()

    class Meta:
        model = Activity
        fields = (
            "id", "title", "description", "date", "start_time", "end_time",
            "category", "category_label", "photos", "participants",
            "participant_count", "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "photos", "participants", "participant_count",
            "category_label", "created_at", "updated_at",
        )

    def get_category_label(self, obj) -> str:
        return ActivityCategory(obj.category).label

    def get_participants(self, obj) -> list[dict]:
        # Uses the viewset's prefetch, so a page of activities does not
        # become an N+1.
        return ParticipantSerializer(
            obj.participations.all(), many=True, context=self.context
        ).data

    def get_participant_count(self, obj) -> int:
        return len(obj.participations.all())

    def validate(self, attrs):
        start = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end = attrs.get("end_time", getattr(self.instance, "end_time", None))
        if start is not None and end is not None and end < start:
            raise serializers.ValidationError(
                {"end_time": "L'heure de fin ne peut pas précéder l'heure de début."}
            )
        return attrs

    def validate_date(self, value):
        from django.utils import timezone

        if value > timezone.localdate():
            raise serializers.ValidationError(
                "Une activité ne peut pas être datée dans le futur."
            )
        return value


class ParentActivitySerializer(ActivitySerializer):
    """What a parent sees: their own child's participation only.

    Listing every other child by name would leak the nursery's roster to
    every family.
    """

    class Meta(ActivitySerializer.Meta):
        fields = (
            "id", "title", "description", "date", "start_time", "end_time",
            "category", "category_label", "photos", "participant_count",
            "created_at",
        )
        read_only_fields = fields


class AddParticipantsSerializer(serializers.Serializer):
    child_ids = serializers.ListField(
        child=serializers.UUIDField(), allow_empty=False, max_length=100
    )


class PhotoUploadSerializer(serializers.Serializer):
    image = serializers.ImageField()
    caption = serializers.CharField(
        max_length=200, required=False, allow_blank=True
    )
