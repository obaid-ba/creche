from __future__ import annotations

from rest_framework import serializers

from .models import Notification, NotificationType


class NotificationSerializer(serializers.ModelSerializer):
    type_label = serializers.SerializerMethodField()
    is_read = serializers.BooleanField(read_only=True)
    child = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = (
            "id", "type", "type_label", "title", "body", "link",
            "child", "is_read", "read_at", "created_at",
        )
        read_only_fields = fields

    def get_type_label(self, obj) -> str:
        return NotificationType(obj.type).label

    def get_child(self, obj) -> dict | None:
        if obj.child is None:
            return None
        return {"id": str(obj.child_id), "first_name": obj.child.first_name}


class NotificationUnreadCountSerializer(serializers.Serializer):
    """Named distinctly from the messaging one so the generated OpenAPI
    client does not end up with two different `UnreadCount` components."""

    unread = serializers.IntegerField(read_only=True)
