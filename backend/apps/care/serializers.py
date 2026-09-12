"""Care serializers (docs/api.md 6-7)."""
from __future__ import annotations

from django.utils import timezone
from django.utils.encoding import force_str
from rest_framework import serializers

from .event_types import (
    TimelineEventType,
    spec_for,
    validate_payload,
)
from .models import DailyRecord, TimelineEvent


class EventAuthorSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    first_name = serializers.CharField(read_only=True)
    last_name = serializers.CharField(read_only=True)


class TimelineEventSerializer(serializers.ModelSerializer):
    """Read shape for one event.

    ``label``, ``icon``, ``duration_minutes`` and the resolved reference
    are all derived — nothing here is a stored copy.
    """

    label = serializers.SerializerMethodField()
    icon = serializers.SerializerMethodField()
    group = serializers.SerializerMethodField()
    duration_minutes = serializers.IntegerField(read_only=True)
    is_open_interval = serializers.BooleanField(read_only=True)
    created_by = EventAuthorSerializer(read_only=True)
    activity = serializers.SerializerMethodField()

    class Meta:
        model = TimelineEvent
        fields = (
            "id", "type", "label", "icon", "group",
            "occurred_at", "ended_at", "local_date",
            "duration_minutes", "is_open_interval",
            "title", "description", "data",
            "activity", "is_published", "created_by", "created_at",
        )
        read_only_fields = fields

    def get_label(self, obj: TimelineEvent) -> str:
        # An explicit title wins; otherwise fall back to the type's label,
        # which is a lazy proxy resolved here against the request language.
        return obj.title or force_str(spec_for(obj.type).label)

    def get_icon(self, obj: TimelineEvent) -> str:
        return spec_for(obj.type).icon

    def get_group(self, obj: TimelineEvent) -> str:
        return spec_for(obj.type).group

    def get_activity(self, obj: TimelineEvent) -> dict | None:
        """Content resolved from the owning aggregate, never copied.

        Editing the activity's title changes what the timeline shows,
        because the timeline never held its own copy (docs/timeline.md 3).
        """
        if obj.activity_id is None:
            return None
        return {
            "id": str(obj.activity.id),
            "title": obj.activity.title,
            "category": obj.activity.category,
        }


class TimelineEventWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimelineEvent
        fields = (
            "type", "occurred_at", "ended_at", "title", "description", "data",
        )

    def validate_type(self, value: str) -> str:
        spec = spec_for(value)
        if not spec.staff_creatable:
            # ACTIVITY and MESSAGE rows are created as a side effect of
            # their owning aggregate, never posted here directly.
            raise serializers.ValidationError(
                f"Les événements de type {value} sont créés automatiquement."
            )
        return value

    def validate_occurred_at(self, value):
        # A small tolerance absorbs clock skew between the tablet used on
        # the floor and the server.
        if value > timezone.now() + timezone.timedelta(minutes=5):
            raise serializers.ValidationError(
                "Un événement ne peut pas être enregistré dans le futur."
            )
        return value

    def validate(self, attrs):
        event_type = attrs.get("type") or getattr(self.instance, "type", None)
        ended_at = attrs.get("ended_at")
        occurred_at = attrs.get("occurred_at") or getattr(
            self.instance, "occurred_at", None
        )

        if ended_at is not None:
            if not spec_for(event_type).interval:
                raise serializers.ValidationError(
                    {"ended_at": "Ce type d'événement n'a pas de durée."}
                )
            if occurred_at is not None and ended_at < occurred_at:
                raise serializers.ValidationError(
                    {"ended_at": "La fin ne peut pas précéder le début."}
                )

        # The payload is validated against the schema declared for this
        # type; unknown keys are rejected rather than silently stored.
        if "data" in attrs or event_type is not None:
            payload = attrs.get("data")
            if payload is None and self.instance is not None:
                payload = self.instance.data
            attrs["data"] = validate_payload(event_type, payload)

        return attrs


class EndIntervalSerializer(serializers.Serializer):
    """Close an open interval, e.g. "Fin sieste"."""

    ended_at = serializers.DateTimeField(required=False)

    def validate_ended_at(self, value):
        if value > timezone.now() + timezone.timedelta(minutes=5):
            raise serializers.ValidationError(
                "La fin ne peut pas être dans le futur."
            )
        return value


class DailyRecordSerializer(serializers.ModelSerializer):
    """The day's non-derivable state plus its computed summary."""

    summary = serializers.SerializerMethodField()
    child = serializers.SerializerMethodField()

    class Meta:
        model = DailyRecord
        fields = (
            "id", "child", "date", "general_notes", "status",
            "published_at", "summary", "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "child", "date", "status", "published_at", "summary",
            "created_at", "updated_at",
        )

    def get_child(self, obj: DailyRecord) -> dict:
        return {
            "id": str(obj.child_id),
            "first_name": obj.child.first_name,
            "last_name": obj.child.last_name,
        }

    def get_summary(self, obj: DailyRecord) -> dict:
        # Supplied by the view, which has already fetched the day's events
        # for the timeline - so this costs no extra query.
        return self.context.get("summary", {})


class DailyRecordWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyRecord
        fields = ("general_notes",)


class EventTypeSpecSerializer(serializers.Serializer):
    key = serializers.CharField(read_only=True)
    label = serializers.CharField(read_only=True)
    icon = serializers.CharField(read_only=True)
    group = serializers.CharField(read_only=True)
    interval = serializers.BooleanField(read_only=True)
    staff_creatable = serializers.BooleanField(read_only=True)
    quick_add = serializers.BooleanField(read_only=True)
