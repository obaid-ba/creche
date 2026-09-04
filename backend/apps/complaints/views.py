"""Complaint endpoints (docs/api.md 10)."""
from __future__ import annotations

from django.db import transaction
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status as http_status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.audit.models import AuditAction
from apps.audit.services import record as record_audit
from apps.children.models import Child
from apps.notifications.services import (
    notify_complaint_created,
    notify_complaint_reply,
    notify_complaint_status,
)
from common.permissions import IsStaff

from .models import Complaint, ComplaintReply, ComplaintStatus, IllegalTransition
from .serializers import (
    AssignSerializer,
    ComplaintCreateSerializer,
    ComplaintReplyCreateSerializer,
    ComplaintSerializer,
    ComplaintStatusSerializer,
)


class ComplaintViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ComplaintSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]
    queryset = Complaint.objects.none()  # lets schema generation see the model

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Complaint.objects.none()

        queryset = Complaint.objects.select_related(
            "parent__user", "child", "assigned_to__user"
        ).prefetch_related(
            Prefetch(
                "replies",
                queryset=ComplaintReply.objects.select_related("author"),
            )
        )

        if user.is_parent:
            profile = getattr(user, "parent_profile", None)
            if profile is None:
                return Complaint.objects.none()
            queryset = queryset.filter(parent=profile)

        params = self.request.query_params
        if params.get("status"):
            queryset = queryset.filter(status=params["status"])
        if params.get("child") and user.is_staff_member:
            queryset = queryset.filter(child_id=params["child"])

        return queryset

    @extend_schema(request=ComplaintCreateSerializer, responses=ComplaintSerializer)
    def create(self, request):
        """Only a parent files a complaint."""
        if not request.user.is_parent:
            raise PermissionDenied("Seuls les parents peuvent déposer une réclamation.")

        serializer = ComplaintCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        child = None
        child_id = serializer.validated_data.get("child_id")
        if child_id is not None:
            # Resolved through the caller's own queryset: a parent cannot
            # file a complaint against another family's child.
            child = get_object_or_404(
                Child.objects.visible_to(request.user), pk=child_id
            )

        with transaction.atomic():
            complaint = Complaint.objects.create(
                parent=request.user.parent_profile,
                child=child,
                subject=serializer.validated_data["subject"],
                message=serializer.validated_data["message"],
            )
            notify_complaint_created(complaint)

        return Response(
            ComplaintSerializer(complaint, context={"request": request}).data,
            status=http_status.HTTP_201_CREATED,
        )

    @extend_schema(
        request=ComplaintStatusSerializer,
        responses=ComplaintSerializer,
        parameters=[
            OpenApiParameter("id", OpenApiTypes.UUID, OpenApiParameter.PATH)
        ],
    )
    @action(
        detail=True, methods=["patch"], url_path="status",
        permission_classes=[IsAuthenticated, IsStaff],
    )
    def change_status(self, request, pk=None):
        complaint = self.get_object()
        serializer = ComplaintStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target = serializer.validated_data["status"]

        try:
            with transaction.atomic():
                previous = complaint.status
                complaint.transition_to(target, by=request.user)
                record_audit(
                    action=AuditAction.COMPLAINT_STATUS_CHANGED,
                    request=request,
                    obj=complaint,
                    child=complaint.child,
                    previous=previous,
                    new=target,
                )
                notify_complaint_status(complaint)
        except IllegalTransition:
            # 409, not 400: the payload is a valid status, but the state
            # machine forbids this move (docs/api.md 10).
            return Response(
                {
                    "detail": (
                        f"Transition impossible : "
                        f"{ComplaintStatus(complaint.status).label} → "
                        f"{ComplaintStatus(target).label}."
                    )
                },
                status=http_status.HTTP_409_CONFLICT,
            )

        return Response(
            ComplaintSerializer(complaint, context={"request": request}).data
        )

    @extend_schema(
        request=ComplaintReplyCreateSerializer,
        responses=ComplaintSerializer,
        parameters=[
            OpenApiParameter("id", OpenApiTypes.UUID, OpenApiParameter.PATH)
        ],
    )
    @action(detail=True, methods=["post"])
    def replies(self, request, pk=None):
        complaint = self.get_object()
        serializer = ComplaintReplyCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        is_internal = serializer.validated_data.get("is_internal", False)
        # A parent could otherwise post a note they would never see again,
        # or probe the internal thread.
        if is_internal and not request.user.is_staff_member:
            raise PermissionDenied("Seul le personnel peut ajouter une note interne.")

        with transaction.atomic():
            reply = ComplaintReply.objects.create(
                complaint=complaint,
                author=request.user,
                body=serializer.validated_data["body"],
                is_internal=is_internal,
            )
            # Internal notes notify nobody.
            notify_complaint_reply(reply)

        complaint.refresh_from_db()
        return Response(
            ComplaintSerializer(
                self.get_queryset().get(pk=complaint.pk),
                context={"request": request},
            ).data,
            status=http_status.HTTP_201_CREATED,
        )

    @extend_schema(
        request=AssignSerializer,
        responses=ComplaintSerializer,
        parameters=[
            OpenApiParameter("id", OpenApiTypes.UUID, OpenApiParameter.PATH)
        ],
    )
    @action(detail=True, methods=["patch"])
    def assign(self, request, pk=None):
        if not request.user.is_admin:
            raise PermissionDenied("Seul un administrateur peut assigner une réclamation.")

        complaint = self.get_object()
        serializer = AssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        staff_id = serializer.validated_data["staff_id"]
        if staff_id is None:
            complaint.assigned_to = None
        else:
            from apps.accounts.models import StaffProfile

            complaint.assigned_to = get_object_or_404(StaffProfile, pk=staff_id)
        complaint.save(update_fields=["assigned_to", "updated_at"])

        return Response(
            ComplaintSerializer(complaint, context={"request": request}).data
        )
