"""Activity endpoints (docs/api.md 8)."""
from __future__ import annotations

import uuid

from django.db import transaction
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.children.models import Child
from apps.notifications.services import notify_activity
from common.images import process_upload
from common.permissions import IsStaff

from .models import Activity, ActivityParticipation, ActivityPhoto
from .serializers import (
    ActivityPhotoSerializer,
    ActivitySerializer,
    AddParticipantsSerializer,
    ParentActivitySerializer,
    PhotoUploadSerializer,
)
from .services import sync_timeline_events


class ActivityViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    ordering = ("-date", "-start_time")

    def get_queryset(self):
        user = self.request.user
        queryset = Activity.objects.prefetch_related(
            Prefetch(
                "participations",
                queryset=ActivityParticipation.objects.select_related("child"),
            ),
            "photos",
        )

        if user.is_authenticated and user.is_parent:
            # A parent sees only activities one of their own children took
            # part in - derived from guardianship, never from a query param.
            queryset = queryset.filter(
                participations__child__in=Child.objects.visible_to(user)
            ).distinct()

        params = self.request.query_params
        if params.get("date"):
            queryset = queryset.filter(date=params["date"])
        if params.get("from"):
            queryset = queryset.filter(date__gte=params["from"])
        if params.get("to"):
            queryset = queryset.filter(date__lte=params["to"])
        if params.get("category"):
            queryset = queryset.filter(category=params["category"])

        # Staff may narrow to one child; a parent's scope is already fixed.
        child = params.get("child")
        if child and user.is_authenticated and user.is_staff_member:
            queryset = queryset.filter(participations__child_id=child).distinct()

        return queryset

    def get_serializer_class(self):
        user = self.request.user
        if user.is_authenticated and user.is_parent:
            return ParentActivitySerializer
        return ActivitySerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return super().get_permissions()
        return [permission() for permission in (IsAuthenticated, IsStaff)]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        with transaction.atomic():
            activity = serializer.save()
            # Timing may have moved, so the reference rows follow it.
            sync_timeline_events(activity)

    def perform_destroy(self, instance):
        # TimelineEvent.activity cascades, so the reference rows go with it.
        instance.delete()

    @extend_schema(
        request=AddParticipantsSerializer,
        responses=ActivitySerializer,
        parameters=[OpenApiParameter("id", str, location="path")],
    )
    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsStaff])
    def participants(self, request, pk=None):
        """Add children, creating their timeline rows in one transaction."""
        activity = self.get_object()
        serializer = AddParticipantsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Resolve through the caller's own queryset: an id for a child the
        # user cannot see simply does not resolve.
        children = list(
            Child.objects.visible_to(request.user).filter(
                id__in=serializer.validated_data["child_ids"]
            )
        )
        if not children:
            return Response(
                {"detail": "Aucun enfant valide dans la sélection."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            ActivityParticipation.objects.bulk_create(
                [
                    ActivityParticipation(activity=activity, child=child)
                    for child in children
                ],
                ignore_conflicts=True,  # re-adding a child is a no-op
            )
            sync_timeline_events(activity)
            notify_activity(activity, children)

        activity.refresh_from_db()
        return Response(
            ActivitySerializer(
                self.get_queryset().get(pk=activity.pk),
                context=self.get_serializer_context(),
            ).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"participants/(?P<child_id>[0-9a-f-]+)",
        permission_classes=[IsAuthenticated, IsStaff],
    )
    def remove_participant(self, request, pk=None, child_id=None):
        activity = self.get_object()

        with transaction.atomic():
            deleted, _ = ActivityParticipation.objects.filter(
                activity=activity, child_id=child_id
            ).delete()
            if deleted == 0:
                return Response(status=status.HTTP_404_NOT_FOUND)
            sync_timeline_events(activity)

        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(request=PhotoUploadSerializer, responses=ActivityPhotoSerializer)
    @action(
        detail=True,
        methods=["post"],
        parser_classes=[MultiPartParser, FormParser],
        permission_classes=[IsAuthenticated, IsStaff],
    )
    def photos(self, request, pk=None):
        activity = self.get_object()
        serializer = PhotoUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Non-enumerable name; the original filename is discarded because
        # it is attacker-controlled and can carry a child's name.
        name = uuid.uuid4().hex
        full, thumb = process_upload(serializer.validated_data["image"], name=name)

        photo = ActivityPhoto.objects.create(
            activity=activity,
            image=full,
            thumbnail=thumb,
            caption=serializer.validated_data.get("caption", ""),
            order=activity.photos.count(),
            uploaded_by=request.user,
        )
        return Response(
            ActivityPhotoSerializer(photo, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"photos/(?P<photo_id>[0-9a-f-]+)",
        permission_classes=[IsAuthenticated, IsStaff],
    )
    def remove_photo(self, request, pk=None, photo_id=None):
        activity = self.get_object()
        photo = get_object_or_404(ActivityPhoto, pk=photo_id, activity=activity)
        photo.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
