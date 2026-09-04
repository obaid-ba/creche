"""Complaint serializers (docs/api.md 10)."""
from __future__ import annotations

from rest_framework import serializers

from .models import Complaint, ComplaintReply, ComplaintStatus


class ComplaintReplySerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()

    class Meta:
        model = ComplaintReply
        fields = ("id", "body", "author", "is_internal", "created_at")
        read_only_fields = fields

    def get_author(self, obj) -> dict | None:
        if obj.author is None:
            return None
        return {
            "id": str(obj.author_id),
            "first_name": obj.author.first_name,
            "last_name": obj.author.last_name,
            "role": obj.author.role,
        }


class ComplaintSerializer(serializers.ModelSerializer):
    status_label = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()
    parent = serializers.SerializerMethodField()
    child = serializers.SerializerMethodField()
    allowed_transitions = serializers.SerializerMethodField()

    class Meta:
        model = Complaint
        fields = (
            "id", "subject", "message", "status", "status_label",
            "parent", "child", "replies", "allowed_transitions",
            "resolved_at", "created_at", "updated_at",
        )
        read_only_fields = fields

    def get_status_label(self, obj) -> str:
        return ComplaintStatus(obj.status).label

    def get_parent(self, obj) -> dict:
        user = obj.parent.user
        return {
            "id": str(obj.parent_id),
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
        }

    def get_child(self, obj) -> dict | None:
        if obj.child is None:
            return None
        return {
            "id": str(obj.child_id),
            "first_name": obj.child.first_name,
            "last_name": obj.child.last_name,
        }

    def get_replies(self, obj) -> list[dict]:
        """Internal notes are filtered out for parents.

        Filtered here rather than in the queryset so the same serializer
        serves both audiences and the rule lives in one place.
        """
        request = self.context.get("request")
        is_staff = (
            request is not None
            and request.user.is_authenticated
            and request.user.is_staff_member
        )

        replies = [
            reply
            for reply in obj.replies.all()
            if is_staff or not reply.is_internal
        ]
        return ComplaintReplySerializer(
            replies, many=True, context=self.context
        ).data

    def get_allowed_transitions(self, obj) -> list[str]:
        """Lets staff UI offer only the moves the server will accept."""
        from .models import ALLOWED_TRANSITIONS

        request = self.context.get("request")
        if (
            request is None
            or not request.user.is_authenticated
            or not request.user.is_staff_member
        ):
            return []
        return sorted(ALLOWED_TRANSITIONS.get(obj.status, set()))


class ComplaintCreateSerializer(serializers.ModelSerializer):
    child_id = serializers.UUIDField(required=False, allow_null=True)

    class Meta:
        model = Complaint
        fields = ("subject", "message", "child_id")

    def validate_subject(self, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Le sujet est requis.")
        return cleaned

    def validate_message(self, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Le message est requis.")
        return cleaned


class ComplaintStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=ComplaintStatus.choices)


class ComplaintReplyCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComplaintReply
        fields = ("body", "is_internal")

    def validate_body(self, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("La réponse ne peut pas être vide.")
        return cleaned


class AssignSerializer(serializers.Serializer):
    staff_id = serializers.UUIDField(allow_null=True)
