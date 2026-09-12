"""Child endpoints (docs/api.md 5).

Authorisation is not decided here: every queryset starts from
``Child.objects.visible_to(request.user)``, so a parent cannot reach
another family's child regardless of the id they send
(docs/authentication.md 5).
"""
from __future__ import annotations

from django.db import transaction
from django.db.models import Prefetch
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.accounts.access_codes import ChildAccessCode
from apps.accounts.models import Guardianship
from apps.audit.models import AuditAction
from apps.audit.services import record as record_audit
from common.age import AgeGroup, GROUP_BOUNDS, group_date_range
from common.permissions import IsStaff

from .filters import ChildFilter
from .models import Child, ChildStatus
from .serializers import (
    AccessCodeResponseSerializer,
    AgeGroupCountSerializer,
    ChildDetailSerializer,
    ChildListSerializer,
    ChildParentSerializer,
    ChildWriteSerializer,
    GuardianLinkSerializer,
)


class ChildViewSet(viewsets.ModelViewSet):
    filterset_class = ChildFilter
    ordering_fields = ("last_name", "first_name", "date_of_birth", "created_at")
    ordering = ("last_name", "first_name")
    search_fields = ("first_name", "last_name")

    def get_queryset(self):
        """Always scoped to the caller.

        ``all_objects`` is used only for staff asking for archived rows;
        parents can never reach it.
        """
        user = self.request.user

        # Archived children are hidden by default. Staff reach them by
        # asking explicitly with ?status=, or implicitly on archive/restore:
        # `restore` operates on an archived record by definition, and
        # `archive` needs to see one to report "already archived" (409)
        # rather than a misleading 404. A parent can never reach an
        # archived child through any of these paths.
        is_staff = user.is_authenticated and user.is_staff_member
        wants_archived = is_staff and (
            self.request.query_params.get("status") in (ChildStatus.ARCHIVED, "all")
            or self.action in ("archive", "restore")
        )
        base = Child.all_objects if wants_archived else Child.objects
        queryset = base.visible_to(user)

        if self.action in ("retrieve", "guardians", "access_code"):
            # Prefetched so the detail serializer's guardian and code
            # lookups do not become N+1 queries.
            queryset = queryset.prefetch_related(
                Prefetch(
                    "guardianships",
                    queryset=Guardianship.objects.select_related("parent__user"),
                ),
                "access_codes",
            )

        return queryset

    def get_serializer_class(self):
        user = self.request.user

        if self.action in ("create", "update", "partial_update"):
            return ChildWriteSerializer

        # A parent gets the reduced representation, so staff-only fields
        # cannot reach them even on their own child.
        if user.is_authenticated and user.is_parent:
            return ChildParentSerializer

        return ChildListSerializer if self.action == "list" else ChildDetailSerializer

    def get_permissions(self):
        # Parents may read their own children; everything else is staff.
        if self.action in ("list", "retrieve"):
            return super().get_permissions()
        return [permission() for permission in (*self.permission_classes, IsStaff)]

    # ── Write actions ───────────────────────────────────────────────────
    def _detail_response(self, child, status_code):
        """Writes echo back the full record.

        The write serializer omits computed fields like age and age_group,
        so returning it would force the client into a second request just
        to render what it just saved.
        """
        return Response(
            ChildDetailSerializer(child, context=self.get_serializer_context()).data,
            status=status_code,
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            child = serializer.save()
            record_audit(
                action=AuditAction.CHILD_CREATED,
                request=request,
                obj=child,
                child=child,
            )
        return self._detail_response(child, status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(
            instance, data=request.data, partial=kwargs.pop("partial", False)
        )
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            child = serializer.save()
            record_audit(
                action=AuditAction.CHILD_UPDATED,
                request=request,
                obj=child,
                child=child,
                changed=list(serializer.validated_data.keys()),
            )
        return self._detail_response(child, status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        """Hard delete is admin-only and audited.

        Archiving is the normal path; this exists for genuine erasure
        requests (docs/architecture.md 2).
        """
        if not request.user.is_admin:
            raise PermissionDenied(
                _("Seul un administrateur peut supprimer définitivement un enfant.")
            )

        child = self.get_object()
        with transaction.atomic():
            record_audit(
                action=AuditAction.CHILD_DELETED,
                request=request,
                obj=child,
                child=None,
                child_name=child.full_name,
            )
            child.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(request=None, responses=ChildDetailSerializer)
    @action(detail=True, methods=["post"], permission_classes=[IsStaff])
    def archive(self, request, pk=None):
        child = self.get_object()
        if child.is_archived:
            return Response(
                {"detail": _("Cet enfant est déjà archivé.")},
                status=status.HTTP_409_CONFLICT,
            )

        with transaction.atomic():
            child.archive(by=request.user)
            record_audit(
                action=AuditAction.CHILD_ARCHIVED,
                request=request,
                obj=child,
                child=child,
            )
        return Response(ChildDetailSerializer(child, context={"request": request}).data)

    @extend_schema(request=None, responses=ChildDetailSerializer)
    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        if not request.user.is_admin:
            raise PermissionDenied(
                _("Seul un administrateur peut restaurer un enfant archivé.")
            )

        child = self.get_object()
        if not child.is_archived:
            return Response(
                {"detail": _("Cet enfant n'est pas archivé.")},
                status=status.HTTP_409_CONFLICT,
            )

        with transaction.atomic():
            child.restore()
            record_audit(
                action=AuditAction.CHILD_RESTORED,
                request=request,
                obj=child,
                child=child,
            )
        return Response(ChildDetailSerializer(child, context={"request": request}).data)

    # ── Guardians ───────────────────────────────────────────────────────
    @action(detail=True, methods=["get", "post"], permission_classes=[IsStaff])
    def guardians(self, request, pk=None):
        child = self.get_object()

        if request.method == "GET":
            return Response(
                ChildDetailSerializer(child, context={"request": request}).data[
                    "guardians"
                ]
            )

        serializer = GuardianLinkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        parent_user = serializer.validated_data["email"]

        with transaction.atomic():
            link, created = Guardianship.objects.get_or_create(
                parent=parent_user.parent_profile,
                child=child,
                defaults={
                    "relationship": serializer.validated_data["relationship"],
                    "granted_by": request.user,
                },
            )
            if not created and link.revoked_at is not None:
                link.revoked_at = None
                link.save(update_fields=["revoked_at", "updated_at"])

            if serializer.validated_data["is_primary"]:
                # The partial unique index allows only one primary guardian,
                # so demote the incumbent in the same transaction.
                Guardianship.objects.filter(
                    child=child, is_primary=True, revoked_at__isnull=True
                ).exclude(pk=link.pk).update(is_primary=False)
                link.is_primary = True
                link.save(update_fields=["is_primary", "updated_at"])

            record_audit(
                action=AuditAction.GUARDIAN_LINKED,
                request=request,
                obj=link,
                child=child,
                parent_email=parent_user.email,
            )

        return Response(
            ChildDetailSerializer(child, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"guardians/(?P<guardian_id>[0-9a-f-]+)",
        permission_classes=[IsStaff],
    )
    def revoke_guardian(self, request, pk=None, guardian_id=None):
        child = self.get_object()
        link = Guardianship.objects.filter(
            pk=guardian_id, child=child, revoked_at__isnull=True
        ).first()

        if link is None:
            return Response(status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            link.revoke()
            record_audit(
                action=AuditAction.GUARDIAN_REVOKED,
                request=request,
                obj=link,
                child=child,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── Access codes ────────────────────────────────────────────────────
    @extend_schema(request=None, responses=AccessCodeResponseSerializer)
    @action(
        detail=True, methods=["post", "delete"], url_path="access-code",
        permission_classes=[IsStaff],
    )
    def access_code(self, request, pk=None):
        child = self.get_object()

        if request.method == "DELETE":
            with transaction.atomic():
                ChildAccessCode.objects.filter(
                    child=child, claimed_at__isnull=True, revoked_at__isnull=True
                ).update(revoked_at=timezone.now())
                record_audit(
                    action=AuditAction.CODE_REVOKED, request=request, child=child
                )
            return Response(status=status.HTTP_204_NO_CONTENT)

        with transaction.atomic():
            code, plain = ChildAccessCode.issue(child=child, issued_by=request.user)
            record_audit(
                action=AuditAction.CODE_ISSUED,
                request=request,
                obj=code,
                child=child,
            )

        # The plaintext exists here and nowhere else - it is not stored and
        # cannot be retrieved again (docs/authentication.md 4.3).
        return Response(
            {
                "code": plain,
                "expires_at": code.expires_at,
                "hint": code.code_hint,
            },
            status=status.HTTP_201_CREATED,
        )


class AgeGroupViewSet(viewsets.ViewSet):
    """Group keys, French labels and live counts for the dashboard."""

    @extend_schema(responses=AgeGroupCountSerializer(many=True))
    def list(self, request):
        queryset = Child.objects.visible_to(request.user)

        payload = []
        for key in GROUP_BOUNDS:
            date_range = group_date_range(key)
            scoped = queryset
            if date_range.after is not None:
                scoped = scoped.filter(date_of_birth__gt=date_range.after)
            if date_range.until is not None:
                scoped = scoped.filter(date_of_birth__lte=date_range.until)

            payload.append(
                {"key": key, "label": AgeGroup(key).label, "count": scoped.count()}
            )

        return Response(payload)
