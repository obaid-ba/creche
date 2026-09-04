"""Care event log and daily record.

``TimelineEvent`` is a single unified log: the source of truth for care
events, and a thin typed *reference* for events whose content belongs to
another aggregate (activity, message). ``DailyRecord`` holds only the
day-scoped facts that are not derivable from events.

Full rationale in docs/timeline.md.
"""
from __future__ import annotations

from django.db import models
from django.utils import timezone

from common.models import BaseModel

from .event_types import TimelineEventType


class DailyRecordStatus(models.TextChoices):
    DRAFT = "DRAFT", "Brouillon"
    PUBLISHED = "PUBLISHED", "Publié"


class TimelineEventQuerySet(models.QuerySet):
    def for_day(self, child, day):
        return self.filter(child=child, local_date=day)

    def visible_to(self, user):
        """Parents see published events only.

        Staff record throughout the day; a parent should not watch a
        half-written day appear (docs/timeline.md 8).
        """
        if not user or not user.is_authenticated:
            return self.none()
        if user.is_staff_member:
            return self
        return self.filter(is_published=True)

    def with_related(self):
        """Bulk-resolve reference rows so the timeline stays O(1) queries."""
        return self.select_related("created_by", "activity", "message").prefetch_related(
            "activity__participations"
        )


class TimelineEvent(BaseModel):
    child = models.ForeignKey(
        "children.Child", on_delete=models.CASCADE, related_name="timeline_events"
    )
    type = models.CharField(max_length=20, choices=TimelineEventType.choices)

    #: When it happened. Staff often record a 10:30 nap at 11:15, so the
    #: timeline orders by this and never by created_at (docs/timeline.md 4.1).
    occurred_at = models.DateTimeField()
    #: Interval end (sleep, activity). NULL means "still open".
    ended_at = models.DateTimeField(null=True, blank=True)

    #: Nursery-local day, derived from occurred_at on save. Denormalised
    #: because `occurred_at::date AT TIME ZONE ...` is not sargable and
    #: would force a sequential scan (docs/timeline.md 6).
    local_date = models.DateField(db_index=True)

    title = models.CharField(max_length=120, blank=True)
    description = models.TextField(blank=True)
    data = models.JSONField(default=dict, blank=True)

    # Reference rows point at the aggregate that owns the content; they
    # never copy it, so an edit there is reflected here automatically.
    activity = models.ForeignKey(
        "activities.Activity", null=True, blank=True,
        on_delete=models.CASCADE, related_name="timeline_events",
    )
    message = models.ForeignKey(
        "messaging.Message", null=True, blank=True,
        on_delete=models.CASCADE, related_name="timeline_events",
    )

    is_published = models.BooleanField(default=False)

    created_by = models.ForeignKey(
        "accounts.User", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )

    objects = TimelineEventQuerySet.as_manager()

    class Meta:
        db_table = "care_timelineevent"
        ordering = ["occurred_at", "created_at"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(ended_at__isnull=True)
                | models.Q(ended_at__gte=models.F("occurred_at")),
                name="timeline_event_end_after_start",
            ),
            # Reference rows must actually reference something.
            models.CheckConstraint(
                condition=~models.Q(type="ACTIVITY")
                | models.Q(activity__isnull=False),
                name="timeline_activity_reference_required",
            ),
            models.CheckConstraint(
                condition=~models.Q(type="MESSAGE") | models.Q(message__isnull=False),
                name="timeline_message_reference_required",
            ),
            # An activity appears at most once per child's timeline.
            models.UniqueConstraint(
                fields=["activity", "child"],
                condition=models.Q(activity__isnull=False),
                name="uniq_activity_event_per_child",
            ),
        ]
        indexes = [
            # The timeline's only hot query shape.
            models.Index(
                fields=["child", "local_date", "occurred_at"],
                name="idx_timeline_child_day",
            ),
            # "Latest events" widgets on both dashboards.
            models.Index(
                fields=["child", "-occurred_at"], name="idx_timeline_child_recent"
            ),
            models.Index(
                fields=["child", "type", "local_date"], name="idx_timeline_child_type"
            ),
        ]
        verbose_name = "Événement"
        verbose_name_plural = "Événements"

    def __str__(self) -> str:
        return f"{self.type} @ {self.occurred_at:%Y-%m-%d %H:%M}"

    def save(self, *args, **kwargs):
        # local_date is always derived, never supplied by a caller, so it
        # cannot disagree with occurred_at.
        if self.occurred_at is not None:
            self.local_date = timezone.localtime(self.occurred_at).date()
        super().save(*args, **kwargs)

    @property
    def duration_minutes(self) -> int | None:
        """Computed, never stored (docs/timeline.md 4.2)."""
        if self.ended_at is None or self.occurred_at is None:
            return None
        return int((self.ended_at - self.occurred_at).total_seconds() // 60)

    @property
    def is_open_interval(self) -> bool:
        """A sleep in progress: started, not yet ended."""
        from .event_types import spec_for

        return spec_for(self.type).interval and self.ended_at is None


class DailyRecord(BaseModel):
    """Day-scoped facts that are **not** derivable from events.

    Deliberately holds no meal/sleep/temperature columns: those are
    aggregated from the event log at read time, which is why the daily
    view and the timeline can never disagree (docs/timeline.md 3.1).
    """

    child = models.ForeignKey(
        "children.Child", on_delete=models.CASCADE, related_name="daily_records"
    )
    date = models.DateField(db_index=True)
    general_notes = models.TextField(blank=True)
    status = models.CharField(
        max_length=10,
        choices=DailyRecordStatus.choices,
        default=DailyRecordStatus.DRAFT,
    )
    published_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        "accounts.User", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )

    class Meta:
        db_table = "care_dailyrecord"
        ordering = ["-date"]
        constraints = [
            models.UniqueConstraint(
                fields=["child", "date"], name="uniq_daily_record_per_child_day"
            ),
        ]
        indexes = [models.Index(fields=["child", "-date"])]
        verbose_name = "Journée"
        verbose_name_plural = "Journées"

    def __str__(self) -> str:
        return f"{self.child_id} · {self.date}"

    @property
    def is_published(self) -> bool:
        return self.status == DailyRecordStatus.PUBLISHED

    def publish(self, *, by=None) -> None:
        """Publishing a day also releases that day's events to parents."""
        self.status = DailyRecordStatus.PUBLISHED
        self.published_at = timezone.now()
        if by is not None and self.created_by is None:
            self.created_by = by
        self.save(update_fields=["status", "published_at", "created_by", "updated_at"])

        TimelineEvent.objects.filter(
            child=self.child, local_date=self.date, is_published=False
        ).update(is_published=True, updated_at=timezone.now())

    def unpublish(self) -> None:
        self.status = DailyRecordStatus.DRAFT
        self.published_at = None
        self.save(update_fields=["status", "published_at", "updated_at"])

        TimelineEvent.objects.filter(
            child=self.child, local_date=self.date
        ).update(is_published=False, updated_at=timezone.now())
