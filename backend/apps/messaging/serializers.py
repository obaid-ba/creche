"""Messaging serializers (docs/api.md 9)."""
from __future__ import annotations

from rest_framework import serializers

from .models import Conversation, Message, MessageAttachment


class AttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = MessageAttachment
        fields = ("id", "file_url", "thumbnail_url", "content_type", "size_bytes")
        read_only_fields = fields

    def _absolute(self, field) -> str | None:
        if not field:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(field.url) if request else field.url

    def get_file_url(self, obj) -> str | None:
        return self._absolute(obj.file)

    def get_thumbnail_url(self, obj) -> str | None:
        return self._absolute(obj.thumbnail or obj.file)


class MessageSerializer(serializers.ModelSerializer):
    sender = serializers.SerializerMethodField()
    attachments = AttachmentSerializer(many=True, read_only=True)
    is_mine = serializers.SerializerMethodField()
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = (
            "id", "conversation", "body", "sender", "attachments",
            "is_mine", "is_read", "created_at",
        )
        read_only_fields = fields

    def get_sender(self, obj) -> dict | None:
        if obj.sender is None:
            return None
        return {
            "id": str(obj.sender_id),
            "first_name": obj.sender.first_name,
            "last_name": obj.sender.last_name,
            "role": obj.sender.role,
        }

    def get_is_mine(self, obj) -> bool:
        request = self.context.get("request")
        return request is not None and obj.sender_id == request.user.id

    def get_is_read(self, obj) -> bool:
        """Whether *this* viewer has read it.

        Uses the prefetched read receipts, so a page of messages does not
        become an N+1.
        """
        request = self.context.get("request")
        if request is None:
            return False
        return any(read.user_id == request.user.id for read in obj.reads.all())


class MessageWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ("body",)

    def validate_body(self, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Le message ne peut pas être vide.")
        return cleaned


class ConversationSerializer(serializers.ModelSerializer):
    child = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = (
            "id", "child", "subject", "is_closed",
            "last_message", "last_message_at", "unread_count", "created_at",
        )
        read_only_fields = fields

    def get_child(self, obj) -> dict:
        return {
            "id": str(obj.child_id),
            "first_name": obj.child.first_name,
            "last_name": obj.child.last_name,
        }

    def get_last_message(self, obj) -> dict | None:
        # Supplied by the viewset's annotation/prefetch rather than a
        # per-row query.
        messages = getattr(obj, "recent_messages", None)
        if not messages:
            return None
        latest = messages[0]
        return {
            "body": latest.body[:120],
            "created_at": latest.created_at,
            "sender_role": latest.sender.role if latest.sender else None,
        }

    def get_unread_count(self, obj) -> int:
        return getattr(obj, "unread_for_user", 0)


class ConversationCreateSerializer(serializers.Serializer):
    child_id = serializers.UUIDField()
    subject = serializers.CharField(max_length=150, required=False, allow_blank=True)
    body = serializers.CharField()

    def validate_body(self, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Le message ne peut pas être vide.")
        return cleaned
