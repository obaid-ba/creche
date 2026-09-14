"""Child endpoints (docs/api.md 5).

Authorisation is not decided here: every queryset starts from
``Child.objects.visible_to(request.user)``, so a parent cannot reach
another family's child regardless of the id they send
(docs/authentication.md 5).
"""
from __future__ import annotations

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.db.models import Prefetch
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.accounts.access_codes import ChildAccessCode
from apps.accounts.models import Guardianship, ParentProfile, User
from apps.audit.models import AuditAction
from apps.audit.services import record as record_audit
from common.age import AgeGroup, GROUP_BOUNDS, group_date_range
from common.permissions import IsStaff

from .filters import ChildFilter
from .models import Child, ChildStatus
from .serializers import (
    AccessCodeResponseSerializer,
    GuardianCreateSerializer,
    AgeGroupCountSerializer,
    ChildDetailSerializer,
    ChildListSerializer,
    ChildParentSerializer,
    ChildWriteSerializer,
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
    @extend_schema(
        request=GuardianCreateSerializer, responses=AccessCodeResponseSerializer
    )
    @action(detail=True, methods=["get", "post"], permission_classes=[IsStaff])
    def guardians(self, request, pk=None):
        """List a child's guardians, or enrol one from the paper form.

        POST is the whole enrolment: the family hands staff the form, staff
        type it in here, and the parent leaves with an access code. They
        fill in nothing themselves and never choose a password.

        Passing `parent_id` links a family that already has an account —
        a second child joining — so both children sit behind one login
        rather than the family ending up with two.
        """
        child = self.get_object()

        if request.method == "GET":
            return Response(
                ChildDetailSerializer(child, context={"request": request}).data[
                    "guardians"
                ]
            )

        serializer = GuardianCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            if data.get("parent_id"):
                profile = get_object_or_404(
                    ParentProfile.objects.select_related("user"),
                    pk=data["parent_id"],
                )
            else:
                user = User.objects.create_parent(
                    first_name=data["first_name"],
                    last_name=data["last_name"],
                    phone=data.get("phone", ""),
                    email=data.get("email") or None,
                )
                profile = ParentProfile.objects.create(user=user)

            link, _created = Guardianship.objects.update_or_create(
                parent=profile,
                child=child,
                defaults={
                    "relationship": data["relationship"],
                    "granted_by": request.user,
                    "revoked_at": None,
                    # The first guardian on a child is the primary contact.
                    "is_primary": not Guardianship.objects.filter(
                        child=child, is_primary=True, revoked_at__isnull=True
                    ).exclude(parent=profile).exists(),
                },
            )
            code, plain = ChildAccessCode.issue(
                child=child, parent=profile, issued_by=request.user
            )
            record_audit(
                action=AuditAction.GUARDIAN_LINKED,
                request=request,
                obj=link,
                child=child,
            )
            record_audit(
                action=AuditAction.CODE_ISSUED, request=request, obj=code, child=child
            )

        return Response(
            self._code_payload(code, plain, child, profile),
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

    # ── Guardians and their access codes ────────────────────────────────
    def _code_payload(self, code, plain, child, profile):
        """The plaintext exists here and nowhere else — it is not stored
        and cannot be retrieved again (docs/authentication.md 4.3)."""
        return {
            "code": plain,
            "hint": code.code_hint,
            "parent_id": profile.pk,
            "parent_name": profile.user.get_full_name(),
            "child_name": child.first_name,
        }

    @extend_schema(request=None, responses=AccessCodeResponseSerializer)
    @action(
        detail=True, methods=["post", "delete"],
        url_path="guardians/(?P<parent_id>[^/.]+)/access-code",
        permission_classes=[IsStaff],
    )
    def access_code(self, request, pk=None, parent_id=None):
        """Reissue or revoke one guardian's code — for a lost paper."""
        child = self.get_object()
        guardianship = get_object_or_404(
            Guardianship.objects.select_related("parent__user"),
            child=child, parent_id=parent_id, revoked_at__isnull=True,
        )
        profile = guardianship.parent

        if request.method == "DELETE":
            with transaction.atomic():
                ChildAccessCode.objects.filter(
                    child=child, parent=profile, revoked_at__isnull=True
                ).update(revoked_at=timezone.now())
                record_audit(
                    action=AuditAction.CODE_REVOKED, request=request, child=child
                )
            return Response(status=status.HTTP_204_NO_CONTENT)

        with transaction.atomic():
            code, plain = ChildAccessCode.issue(
                child=child, parent=profile, issued_by=request.user
            )
            record_audit(
                action=AuditAction.CODE_ISSUED, request=request, obj=code, child=child
            )

        return Response(
            self._code_payload(code, plain, child, profile),
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
