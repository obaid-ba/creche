"""Notification endpoints (docs/api.md 11)."""
from __future__ import annotations

from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Notification
from .serializers import (
    NotificationSerializer,
    NotificationUnreadCountSerializer,
)


class NotificationViewSet(
    mixins.ListModelMixin, viewsets.GenericViewSet
):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer
    queryset = Notification.objects.none()

    def get_queryset(self):
        # Always the caller's own; there is no path to anyone else's.
        queryset = Notification.objects.for_user(self.request.user).select_related(
            "child"
        )
        if self.request.query_params.get("unread") == "true":
            queryset = queryset.unread()
        return queryset

    @extend_schema(
        request=None,
        responses=NotificationSerializer,
        parameters=[
            OpenApiParameter("id", OpenApiTypes.UUID, OpenApiParameter.PATH)
        ],
    )
    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        notification = self.get_object()
        notification.mark_read()
        return Response(NotificationSerializer(notification).data)

    @extend_schema(request=None, responses={204: None})
    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        self.get_queryset().unread().update(
            read_at=timezone.now(), updated_at=timezone.now()
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(responses=NotificationUnreadCountSerializer)
    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        count = Notification.objects.for_user(request.user).unread().count()
        return Response({"unread": count})
