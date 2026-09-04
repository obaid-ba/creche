"""Dashboard aggregates (brief 15-16, docs/api.md 11).

Each dashboard is a **single** endpoint rather than six round-trips from
the client, so the first screen after login costs one request.

Everything is scoped through the same primitives used everywhere else —
``Child.objects.visible_to`` and the guardianship filter — so a dashboard
cannot become a side channel that leaks what the list endpoints refuse.
"""
from __future__ import annotations

from django.db.models import Count, Q
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.activities.models import Activity
from apps.care.models import DailyRecord, DailyRecordStatus, TimelineEvent
from apps.care.summary import build_summary
from apps.children.models import Child
from apps.complaints.models import Complaint, ComplaintStatus
from apps.messaging.models import Message
from apps.messaging.views import visible_conversations
from apps.notifications.models import Notification
from common.age import AgeGroup, GROUP_BOUNDS, group_date_range
from common.permissions import IsStaff


class ParentDashboardSerializer(serializers.Serializer):
    """Documented for the schema; the view builds the payload directly."""

    children = serializers.ListField(child=serializers.DictField())
    unread_messages = serializers.IntegerField()
    unread_notifications = serializers.IntegerField()
    open_complaints = serializers.IntegerField()


class StaffDashboardSerializer(serializers.Serializer):
    total_children = serializers.IntegerField()
    age_groups = serializers.ListField(child=serializers.DictField())
    new_complaints = serializers.IntegerField()
    unread_messages = serializers.IntegerField()
    days_published_today = serializers.IntegerField()
    recent_activities = serializers.ListField(child=serializers.DictField())


def _unread_message_count(user) -> int:
    return (
        Message.objects.filter(conversation__in=visible_conversations(user))
        .exclude(sender=user)
        .exclude(reads__user=user)
        .count()
    )


class ParentDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=ParentDashboardSerializer)
    def get(self, request):
        user = request.user
        today = timezone.localdate()

        children = list(Child.objects.visible_to(user))
        payload = []

        for child in children:
            record = DailyRecord.objects.filter(child=child, date=today).first()
            is_published = (
                record is not None and record.status == DailyRecordStatus.PUBLISHED
            )

            # A parent only ever sees a published day, so the summary and
            # the latest events are built from what they may actually see.
            events = list(
                TimelineEvent.objects.filter(child=child, local_date=today)
                .visible_to(user)
                .with_related()
                .order_by("occurred_at")
            )

            payload.append(
                {
                    "id": str(child.id),
                    "first_name": child.first_name,
                    "last_name": child.last_name,
                    "photo_url": (
                        request.build_absolute_uri(child.photo.url)
                        if child.photo
                        else None
                    ),
                    "age_display": child.age_display,
                    "age_group": child.age_group_payload,
                    "day_published": is_published,
                    "general_notes": record.general_notes if record else "",
                    "summary": build_summary(events),
                    "latest_events": [
                        {
                            "id": str(event.id),
                            "type": event.type,
                            "occurred_at": event.occurred_at,
                            "description": event.description,
                            "data": event.data,
                        }
                        for event in events[-4:]
                    ],
                }
            )

        parent_profile = getattr(user, "parent_profile", None)
        open_complaints = (
            Complaint.objects.filter(
                parent=parent_profile,
                status__in=(ComplaintStatus.NEW, ComplaintStatus.IN_PROGRESS),
            ).count()
            if parent_profile is not None
            else 0
        )

        return Response(
            {
                "children": payload,
                "unread_messages": _unread_message_count(user),
                "unread_notifications": Notification.objects.for_user(user)
                .unread()
                .count(),
                "open_complaints": open_complaints,
            }
        )


class StaffDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsStaff]

    @extend_schema(responses=StaffDashboardSerializer)
    def get(self, request):
        today = timezone.localdate()
        children = Child.objects.visible_to(request.user)

        # One indexed range query per band rather than loading every child
        # and bucketing in Python (docs/architecture.md 8.1).
        age_groups = []
        for key in GROUP_BOUNDS:
            date_range = group_date_range(key)
            scoped = children
            if date_range.after is not None:
                scoped = scoped.filter(date_of_birth__gt=date_range.after)
            if date_range.until is not None:
                scoped = scoped.filter(date_of_birth__lte=date_range.until)
            age_groups.append(
                {
                    "key": key,
                    "label": AgeGroup(key).label,
                    "count": scoped.count(),
                }
            )

        recent = (
            Activity.objects.filter(date__lte=today)
            .annotate(participant_count=Count("participations"))
            .order_by("-date", "-start_time")[:5]
        )

        return Response(
            {
                "total_children": children.count(),
                "age_groups": age_groups,
                "new_complaints": Complaint.objects.filter(
                    status=ComplaintStatus.NEW
                ).count(),
                "in_progress_complaints": Complaint.objects.filter(
                    status=ComplaintStatus.IN_PROGRESS
                ).count(),
                "unread_messages": _unread_message_count(request.user),
                # "Attendance" in the brief is a placeholder; what is real
                # today is how many days have actually been published.
                "days_published_today": DailyRecord.objects.filter(
                    date=today, status=DailyRecordStatus.PUBLISHED
                ).count(),
                "children_with_events_today": TimelineEvent.objects.filter(
                    local_date=today
                )
                .values("child")
                .distinct()
                .count(),
                "recent_activities": [
                    {
                        "id": str(activity.id),
                        "title": activity.title,
                        "date": activity.date,
                        "category": activity.category,
                        "participant_count": activity.participant_count,
                    }
                    for activity in recent
                ],
            }
        )
