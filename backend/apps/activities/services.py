"""Activity ↔ timeline projection.

Adding a child to an activity creates one ``ACTIVITY`` timeline row for
that child. The row is a **reference**: it carries the FK and the time,
never a copy of the title or description, so editing the activity is
immediately reflected in every child's timeline (docs/timeline.md 3).

All of this runs inside the caller's transaction, so an activity and its
timeline rows can never be half-created.
"""
from __future__ import annotations

from datetime import datetime, time

from django.utils import timezone

from apps.care.event_types import TimelineEventType
from apps.care.models import DailyRecord, DailyRecordStatus, TimelineEvent

from .models import Activity


def _occurred_at(activity: Activity) -> datetime:
    """When the activity happened, in the nursery's timezone.

    Falls back to midday rather than midnight for an activity with no
    start time, so it sorts sensibly among the day's meals and naps
    instead of jumping to the top of the timeline.
    """
    start = activity.start_time or time(12, 0)
    naive = datetime.combine(activity.date, start)
    return timezone.make_aware(naive, timezone.get_current_timezone())


def _ended_at(activity: Activity) -> datetime | None:
    if activity.end_time is None:
        return None
    naive = datetime.combine(activity.date, activity.end_time)
    return timezone.make_aware(naive, timezone.get_current_timezone())


def sync_timeline_events(activity: Activity) -> None:
    """Make the activity's timeline rows match its participants.

    Idempotent: safe to call after any change to the activity or its
    participant list.
    """
    occurred_at = _occurred_at(activity)
    ended_at = _ended_at(activity)
    local_date = timezone.localtime(occurred_at).date()

    participant_ids = set(
        activity.participations.values_list("child_id", flat=True)
    )
    existing = {
        event.child_id: event
        for event in TimelineEvent.objects.filter(activity=activity)
    }

    # Remove rows for children no longer taking part.
    stale = set(existing) - participant_ids
    if stale:
        TimelineEvent.objects.filter(
            activity=activity, child_id__in=stale
        ).delete()

    for child_id in participant_ids:
        event = existing.get(child_id)
        if event is None:
            # A day already published stays published, so a late activity
            # does not silently disappear from the parent's view.
            published = DailyRecord.objects.filter(
                child_id=child_id,
                date=local_date,
                status=DailyRecordStatus.PUBLISHED,
            ).exists()

            TimelineEvent.objects.create(
                child_id=child_id,
                activity=activity,
                type=TimelineEventType.ACTIVITY,
                occurred_at=occurred_at,
                ended_at=ended_at,
                is_published=published,
                created_by=activity.created_by,
            )
        elif event.occurred_at != occurred_at or event.ended_at != ended_at:
            # Only the timing is denormalised onto the row (it is what the
            # timeline sorts by); title and description are never copied.
            event.occurred_at = occurred_at
            event.ended_at = ended_at
            event.save(update_fields=["occurred_at", "ended_at", "local_date",
                                      "updated_at"])
