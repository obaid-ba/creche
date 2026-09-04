"""Activities.

The model lands here in Phase 4 because ``TimelineEvent`` references it:
an ``ACTIVITY`` timeline row points at an activity rather than copying its
title, so editing the activity updates the timeline automatically
(docs/timeline.md 3). The activities API and UI arrive in Phase 6.
"""
from __future__ import annotations

from django.db import models

from common.models import BaseModel


class ActivityCategory(models.TextChoices):
    ART = "ART", "Arts plastiques"
    MUSIC = "MUSIC", "Musique"
    OUTDOOR = "OUTDOOR", "Jeux extérieurs"
    STORY = "STORY", "Lecture"
    MOTOR = "MOTOR", "Motricité"
    EDUCATIONAL = "EDUCATIONAL", "Éveil éducatif"
    OTHER = "OTHER", "Autre"


class Activity(BaseModel):
    title = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    date = models.DateField(db_index=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    category = models.CharField(
        max_length=20, choices=ActivityCategory.choices, default=ActivityCategory.OTHER
    )
    created_by = models.ForeignKey(
        "accounts.User", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )

    class Meta:
        db_table = "activities_activity"
        ordering = ["-date", "-start_time"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(end_time__isnull=True)
                | models.Q(start_time__isnull=True)
                | models.Q(end_time__gte=models.F("start_time")),
                name="activity_end_after_start",
            ),
        ]
        indexes = [models.Index(fields=["-date"])]
        verbose_name = "Activité"
        verbose_name_plural = "Activités"

    def __str__(self) -> str:
        return f"{self.title} ({self.date})"


class ActivityParticipation(BaseModel):
    activity = models.ForeignKey(
        Activity, on_delete=models.CASCADE, related_name="participations"
    )
    child = models.ForeignKey(
        "children.Child", on_delete=models.CASCADE, related_name="activity_participations"
    )
    note = models.TextField(blank=True)

    class Meta:
        db_table = "activities_activityparticipation"
        constraints = [
            models.UniqueConstraint(
                fields=["activity", "child"], name="uniq_activity_participation"
            ),
        ]
        indexes = [models.Index(fields=["child", "activity"])]
        verbose_name = "Participation"
        verbose_name_plural = "Participations"

    def __str__(self) -> str:
        return f"{self.child_id} → {self.activity_id}"


class ActivityPhoto(BaseModel):
    activity = models.ForeignKey(
        Activity, on_delete=models.CASCADE, related_name="photos"
    )
    image = models.ImageField(upload_to="activities/photos/")
    thumbnail = models.ImageField(
        upload_to="activities/thumbnails/", null=True, blank=True
    )
    caption = models.CharField(max_length=200, blank=True)
    order = models.PositiveSmallIntegerField(default=0)
    uploaded_by = models.ForeignKey(
        "accounts.User", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )

    class Meta:
        db_table = "activities_activityphoto"
        ordering = ["order", "created_at"]
        verbose_name = "Photo d'activité"
        verbose_name_plural = "Photos d'activité"
