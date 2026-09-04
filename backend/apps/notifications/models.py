"""In-app notifications.

Fan-out happens at the moment of the triggering event, inside the same
transaction, so a notification can never survive a rolled-back change.
Recipients are always *derived* from the domain (guardianship, staff
role) rather than passed in by a caller.
"""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone

from common.models import BaseModel


class NotificationType(models.TextChoices):
    NEW_MESSAGE = "NEW_MESSAGE", "Nouveau message"
    DAY_PUBLISHED = "DAY_PUBLISHED", "Journée publiée"
    NEW_ACTIVITY = "NEW_ACTIVITY", "Nouvelle activité"
    COMPLAINT_CREATED = "COMPLAINT_CREATED", "Nouvelle réclamation"
    COMPLAINT_UPDATED = "COMPLAINT_UPDATED", "Réclamation mise à jour"
    COMPLAINT_REPLY = "COMPLAINT_REPLY", "Réponse à une réclamation"


class NotificationQuerySet(models.QuerySet):
    def unread(self):
        return self.filter(read_at__isnull=True)

    def for_user(self, user):
        if not user or not user.is_authenticated:
            return self.none()
        return self.filter(user=user)


class Notification(BaseModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="notifications",
    )
    type = models.CharField(max_length=30, choices=NotificationType.choices)
    title = models.CharField(max_length=150)
    body = models.TextField(blank=True)
    #: In-app route the notification points at.
    link = models.CharField(max_length=255, blank=True)

    child = models.ForeignKey(
        "children.Child", null=True, blank=True,
        on_delete=models.CASCADE, related_name="notifications",
    )

    read_at = models.DateTimeField(null=True, blank=True)

    objects = NotificationQuerySet.as_manager()

    class Meta:
        db_table = "notifications_notification"
        ordering = ["-created_at"]
        indexes = [
            # Serves both the unread badge and the list.
            models.Index(fields=["user", "read_at", "-created_at"]),
        ]
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"

    def __str__(self) -> str:
        return f"{self.type} -> {self.user_id}"

    @property
    def is_read(self) -> bool:
        return self.read_at is not None

    def mark_read(self) -> None:
        if self.read_at is None:
            self.read_at = timezone.now()
            self.save(update_fields=["read_at", "updated_at"])
