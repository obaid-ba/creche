"""Timeline and daily-record endpoints (docs/api.md 6-7).

Every view resolves its child through ``ChildScopedMixin.get_child()``,
which looks the id up inside ``Child.objects.visible_to(request.user)`` —
so an unowned child id simply does not resolve (docs/authentication.md 5).
"""
from __future__ import annotations

from datetime import date as date_cls

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.notifications.services import notify_day_published
from common.mixins import ChildScopedMixin
from common.permissions import IsStaff

from .event_types import registry_payload, types_for_filter
from .models import DailyRecord, DailyRecordStatus, TimelineEvent
from .serializers import (
    DailyRecordSerializer,
    DailyRecordWriteSerializer,
    EndIntervalSerializer,
    EventTypeSpecSerializer,
    TimelineEventSerializer,
    TimelineEventWriteSerializer,
)
from .summary import build_summary


def parse_date(raw: str | None, *, field: str = "date") -> date_cls:
    """Parse ?date=YYYY-MM-DD, defaulting to the nursery-local today."""
    if not raw:
        return timezone.localdate()
    parsed = date_cls.fromisoformat(raw) if _is_iso(raw) else None
    if parsed is None:
        raise ValidationError({field: "Date invalide. Format attendu : AAAA-MM-JJ."})
    return parsed


def _is_iso(raw: str) -> bool:
    try:
        date_cls.fromisoformat(raw)
    except ValueError:
        return False
    return True


class ChildTimelineView(ChildScopedMixin, APIView):
    """List a child's day, and record new events."""

    permission_classes = [IsAuthenticated]
    child_url_kwarg = "child_id"

    @extend_schema(
        parameters=[
            OpenApiParameter("date", str, description="AAAA-MM-JJ (default: today)"),
            OpenApiParameter("from", str), OpenApiParameter("to", str),
            OpenApiParameter("types", str, description="Comma-separated event types"),
            OpenApiParameter(
                "filter", str,
                description="meals | sleep | activities | health | hygiene | all",
            ),
        ],
        responses=TimelineEventSerializer(many=True),
    )
    def get(self, request, child_id=None):
        child = self.get_child()
        params = request.query_params

        # One indexed query; reference rows resolved in bulk. The query
        # count stays constant regardless of how many events the day has
        # (docs/timeline.md 6).
        queryset = (
            TimelineEvent.objects.filter(child=child)
            .visible_to(request.user)
            .with_related()
        )

        date_from, date_to = params.get("from"), params.get("to")
        if date_from or date_to:
            if date_from:
                queryset = queryset.filter(local_date__gte=parse_date(date_from, field="from"))
            if date_to:
                queryset = queryset.filter(local_date__lte=parse_date(date_to, field="to"))
            day = None
        else:
            day = parse_date(params.get("date"))
            queryset = queryset.filter(local_date=day)

        # Explicit types win over the coarser filter chip.
        requested_types = params.get("types")
        if requested_types:
            queryset = queryset.filter(
                type__in=[t.strip() for t in requested_types.split(",") if t.strip()]
            )
        else:
            group_types = types_for_filter(params.get("filter"))
            if group_types is not None:
                queryset = queryset.filter(type__in=group_types)

        events = list(queryset.order_by("occurred_at", "created_at"))

        return Response(
            {
                "date": day.isoformat() if day else None,
                "child": {
                    "id": str(child.id),
                    "first_name": child.first_name,
                    "last_name": child.last_name,
                },
                "count": len(events),
                "results": TimelineEventSerializer(
                    events, many=True, context={"request": request}
                ).data,
            }
        )

    @extend_schema(
        request=TimelineEventWriteSerializer, responses=TimelineEventSerializer
    )
    def post(self, request, child_id=None):
        self.check_staff(request)
        child = self.get_child()

        serializer = TimelineEventWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            # `child` comes from the URL and `created_by` from the token;
            # both are ignored if the client sends them (docs/api.md 12).
            event = serializer.save(child=child, created_by=request.user)
            # An event recorded on a day already published stays visible,
            # rather than silently disappearing from the parent's view.
            record = DailyRecord.objects.filter(
                child=child, date=event.local_date
            ).first()
            if record is not None and record.is_published:
                event.is_published = True
                event.save(update_fields=["is_published", "updated_at"])

        return Response(
            TimelineEventSerializer(event, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def check_staff(self, request):
        if not request.user.is_staff_member:
            self.permission_denied(
                request, message=_("Seul le personnel peut enregistrer un événement.")
            )


class TimelineEventViewSet(viewsets.GenericViewSet):
    """Update, delete and close individual events."""

    permission_classes = [IsAuthenticated, IsStaff]
    serializer_class = TimelineEventWriteSerializer

    def get_queryset(self):
        # Scoped through the child, so ownership is enforced the same way
        # here as on every other child-scoped resource.
        from apps.children.models import Child

        return TimelineEvent.objects.filter(
            child__in=Child.objects.visible_to(self.request.user)
        ).with_related()

    def partial_update(self, request, pk=None):
        event = get_object_or_404(self.get_queryset(), pk=pk)
        serializer = TimelineEventWriteSerializer(
            event, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            TimelineEventSerializer(event, context={"request": request}).data
        )

    def destroy(self, request, pk=None):
        event = get_object_or_404(self.get_queryset(), pk=pk)
        event.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(request=EndIntervalSerializer, responses=TimelineEventSerializer)
    @action(detail=True, methods=["post"])
    def end(self, request, pk=None):
        """Close an open interval — the "Fin sieste" tap.

        One row, two interactions: no reconciliation logic, and no way to
        end up with an orphaned end-event (docs/timeline.md 4.2).
        """
        event = get_object_or_404(self.get_queryset(), pk=pk)

        if not event.is_open_interval:
            return Response(
                {"detail": "Cet événement n'est pas en cours."},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = EndIntervalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ended_at = serializer.validated_data.get("ended_at") or timezone.now()

        if ended_at < event.occurred_at:
            raise ValidationError(
                {"ended_at": _("La fin ne peut pas précéder le début.")}
            )

        event.ended_at = ended_at
        event.save(update_fields=["ended_at", "updated_at"])

        return Response(
            TimelineEventSerializer(event, context={"request": request}).data
        )


class ChildDailyRecordView(ChildScopedMixin, APIView):
    """The day's notes, status and computed summary."""

    permission_classes = [IsAuthenticated]
    child_url_kwarg = "child_id"

    def _record_and_summary(self, child, day, user):
        record = DailyRecord.objects.filter(child=child, date=day).first()

        events = list(
            TimelineEvent.objects.filter(child=child, local_date=day)
            .visible_to(user)
            .order_by("occurred_at", "created_at")
        )
        return record, build_summary(events)

    @extend_schema(
        parameters=[OpenApiParameter("date", str)],
        responses=DailyRecordSerializer,
    )
    def get(self, request, child_id=None):
        child = self.get_child()
        day = parse_date(request.query_params.get("date"))
        record, summary = self._record_and_summary(child, day, request.user)

        if record is None:
            # A day with no record yet is a legitimate empty day, not a
            # 404 - the parent should still see "rien à signaler".
            return Response(
                {
                    "id": None,
                    "child": {
                        "id": str(child.id),
                        "first_name": child.first_name,
                        "last_name": child.last_name,
                    },
                    "date": day.isoformat(),
                    "general_notes": "",
                    "status": DailyRecordStatus.DRAFT,
                    "published_at": None,
                    "summary": summary,
                }
            )

        return Response(
            DailyRecordSerializer(
                record, context={"request": request, "summary": summary}
            ).data
        )

    @extend_schema(request=DailyRecordWriteSerializer, responses=DailyRecordSerializer)
    def put(self, request, child_id=None):
        if not request.user.is_staff_member:
            self.permission_denied(request, message="Réservé au personnel.")

        child = self.get_child()
        day = parse_date(request.query_params.get("date"))

        serializer = DailyRecordWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            record, _ = DailyRecord.objects.get_or_create(
                child=child, date=day, defaults={"created_by": request.user}
            )
            record.general_notes = serializer.validated_data.get("general_notes", "")
            record.save(update_fields=["general_notes", "updated_at"])

        _, summary = self._record_and_summary(child, day, request.user)
        return Response(
            DailyRecordSerializer(
                record, context={"request": request, "summary": summary}
            ).data
        )


class ChildDailyRecordPublishView(ChildScopedMixin, APIView):
    permission_classes = [IsAuthenticated, IsStaff]
    child_url_kwarg = "child_id"

    @extend_schema(request=None, responses=DailyRecordSerializer)
    def post(self, request, child_id=None):
        child = self.get_child()
        day = parse_date(request.query_params.get("date"))

        with transaction.atomic():
            record, _ = DailyRecord.objects.get_or_create(
                child=child, date=day, defaults={"created_by": request.user}
            )
            was_published = record.is_published
            record.publish(by=request.user)
            # Re-publishing a correction should not notify the family again.
            if not was_published:
                notify_day_published(record)

        events = list(
            TimelineEvent.objects.filter(child=child, local_date=day)
            .order_by("occurred_at", "created_at")
        )
        return Response(
            DailyRecordSerializer(
                record,
                context={"request": request, "summary": build_summary(events)},
            ).data
        )

    @extend_schema(request=None, responses=DailyRecordSerializer)
    def delete(self, request, child_id=None):
        """Un-publish, e.g. to correct a day released by mistake."""
        child = self.get_child()
        day = parse_date(request.query_params.get("date"))

        record = DailyRecord.objects.filter(child=child, date=day).first()
        if record is None:
            return Response(status=status.HTTP_404_NOT_FOUND)

        record.unpublish()
        return Response(status=status.HTTP_204_NO_CONTENT)


class EventTypeListView(APIView):
    """The registry, so the frontend never hardcodes the type list."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses=EventTypeSpecSerializer(many=True))
    def get(self, request):
        from .event_types import GROUP_TYPES, EventGroup

        return Response(
            {
                "types": registry_payload(),
                "filters": [
                    {
                        "key": group,
                        "label": EventGroup(group).label,
                        "types": types,
                    }
                    for group, types in GROUP_TYPES.items()
                ],
            }
        )
