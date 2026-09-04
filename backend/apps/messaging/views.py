"""Messaging endpoints (docs/api.md 9).

Conversations are scoped to a child, so parent authorisation reuses the
same guardianship check as everything else: a conversation about a child
the caller cannot see simply does not resolve (docs/database.md 7).
"""
from __future__ import annotations

import uuid

from django.db import transaction
from django.db.models import Count, Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.children.models import Child
from common.images import process_upload
from common.pagination import MessageCursorPagination

from .models import Conversation, Message, MessageAttachment, MessageRead
from .serializers import (
    AttachmentSerializer,
    ConversationCreateSerializer,
    ConversationSerializer,
    MessageSerializer,
    MessageWriteSerializer,
)


def visible_conversations(user):
    """Conversations about a child the caller may see."""
    return Conversation.objects.filter(
        child__in=Child.objects.visible_to(user)
    ).select_related("child")


class ConversationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ConversationSerializer
    http_method_names = ["get", "post", "head", "options"]
    #: Lets schema generation derive the model without calling
    #: get_queryset(), which needs an authenticated user.
    queryset = Conversation.objects.none()

    def get_queryset(self):
        user = self.request.user
        # The unread annotation compares against the user's id, so an
        # anonymous user would raise instead of returning nothing.
        # Permissions already block this; failing closed is cheaper than
        # relying on that alone.
        if not user.is_authenticated:
            return Conversation.objects.none()

        return (
            visible_conversations(user)
            .prefetch_related(
                Prefetch(
                    "messages",
                    queryset=Message.objects.select_related("sender").order_by(
                        "-created_at"
                    )[:1],
                    to_attr="recent_messages",
                )
            )
            .annotate(
                # Unread = messages this user neither sent nor has read.
                unread_for_user=Count(
                    "messages",
                    filter=~Q(messages__sender=user)
                    & ~Q(messages__reads__user=user),
                    distinct=True,
                )
            )
            .order_by("-last_message_at", "-created_at")
        )

    @extend_schema(request=ConversationCreateSerializer, responses=ConversationSerializer)
    def create(self, request):
        serializer = ConversationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Resolved through the caller's own queryset; an unowned child id
        # does not resolve.
        child = get_object_or_404(
            Child.objects.visible_to(request.user),
            pk=serializer.validated_data["child_id"],
        )
        self._check_can_send(request)

        with transaction.atomic():
            conversation = Conversation.objects.create(
                child=child,
                subject=serializer.validated_data.get("subject", ""),
            )
            message = Message.objects.create(
                conversation=conversation,
                sender=request.user,
                body=serializer.validated_data["body"],
            )
            conversation.last_message_at = message.created_at
            conversation.save(update_fields=["last_message_at", "updated_at"])

        return Response(
            ConversationSerializer(
                self.get_queryset().get(pk=conversation.pk),
                context={"request": request},
            ).data,
            status=status.HTTP_201_CREATED,
        )

    @staticmethod
    def _check_can_send(request):
        """A parent may post only if the nursery allows it (brief 13)."""
        user = request.user
        if user.is_parent:
            profile = getattr(user, "parent_profile", None)
            if profile is None or not profile.can_send_messages:
                raise PermissionDenied(
                    "L'envoi de messages n'est pas activé pour votre compte."
                )

    @extend_schema(
        request=MessageWriteSerializer,
        responses=MessageSerializer(many=True),
        parameters=[
            OpenApiParameter(
                "id", OpenApiTypes.UUID, OpenApiParameter.PATH,
                description="Conversation id",
            )
        ],
    )
    @action(detail=True, methods=["get", "post"])
    def messages(self, request, pk=None):
        conversation = self.get_object()

        if request.method == "GET":
            queryset = (
                Message.objects.filter(conversation=conversation)
                .select_related("sender")
                .prefetch_related("attachments", "reads")
                .order_by("-created_at")
            )
            paginator = MessageCursorPagination()
            page = paginator.paginate_queryset(queryset, request, view=self)
            return paginator.get_paginated_response(
                MessageSerializer(page, many=True, context={"request": request}).data
            )

        self._check_can_send(request)
        serializer = MessageWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            message = Message.objects.create(
                conversation=conversation,
                sender=request.user,
                body=serializer.validated_data["body"],
            )
            conversation.last_message_at = message.created_at
            conversation.save(update_fields=["last_message_at", "updated_at"])

        return Response(
            MessageSerializer(message, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        request=None,
        responses={204: None},
        parameters=[
            OpenApiParameter("id", OpenApiTypes.UUID, OpenApiParameter.PATH)
        ],
    )
    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        """Mark every message in the conversation as read by this user."""
        conversation = self.get_object()

        unread = Message.objects.filter(conversation=conversation).exclude(
            reads__user=request.user
        ).exclude(sender=request.user)

        MessageRead.objects.bulk_create(
            [MessageRead(message=message, user=request.user) for message in unread],
            ignore_conflicts=True,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(
        request=None,
        responses=AttachmentSerializer,
        parameters=[
            OpenApiParameter("id", OpenApiTypes.UUID, OpenApiParameter.PATH),
            OpenApiParameter(
                "message_id", OpenApiTypes.UUID, OpenApiParameter.PATH
            ),
        ],
    )
    @action(
        detail=True,
        methods=["post"],
        url_path=r"messages/(?P<message_id>[0-9a-f-]+)/attachments",
        parser_classes=[MultiPartParser, FormParser],
    )
    def attachments(self, request, pk=None, message_id=None):
        conversation = self.get_object()
        message = get_object_or_404(
            Message, pk=message_id, conversation=conversation
        )
        if message.sender_id != request.user.id:
            raise PermissionDenied(
                "Vous ne pouvez joindre un fichier qu'à vos propres messages."
            )

        uploaded = request.FILES.get("file")
        if uploaded is None:
            return Response(
                {"detail": "Aucun fichier fourni."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Same hostile-input handling as activity photos: sniffed, EXIF
        # stripped, stored under a non-enumerable name.
        name = uuid.uuid4().hex
        full, thumb = process_upload(uploaded, name=name)

        attachment = MessageAttachment.objects.create(
            message=message,
            file=full,
            thumbnail=thumb,
            content_type="image/jpeg",
            size_bytes=full.size,
        )
        return Response(
            AttachmentSerializer(attachment, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class UnreadCountSerializer(serializers.Serializer):
    unread = serializers.IntegerField(read_only=True)


class UnreadCountView(APIView):
    """Badge count across every conversation the caller can see."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses=UnreadCountSerializer)
    def get(self, request):
        count = (
            Message.objects.filter(
                conversation__in=visible_conversations(request.user)
            )
            .exclude(sender=request.user)
            .exclude(reads__user=request.user)
            .count()
        )
        return Response({"unread": count})
