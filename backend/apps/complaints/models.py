"""Complaints (réclamations).

The status field is a state machine, not a free-form value: a complaint
moves forward through triage and can be closed, but never silently walks
backwards. The allowed transitions live on the model so every caller —
API, admin, future automation — is bound by the same rule
(docs/database.md 8).
"""
from __future__ import annotations

from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from common.models import BaseModel


class ComplaintStatus(models.TextChoices):
    NEW = "NEW", _("Nouvelle")
    IN_PROGRESS = "IN_PROGRESS", _("En cours")
    RESOLVED = "RESOLVED", _("Résolue")
    CLOSED = "CLOSED", _("Clôturée")


#: Which statuses each status may move to.
#:
#: NEW -> CLOSED is allowed so an obvious duplicate can be dismissed
#: without pretending to work on it. RESOLVED -> IN_PROGRESS is allowed
#: because a parent may reply saying the problem persists, and reopening
#: is more honest than raising a second complaint.
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    ComplaintStatus.NEW: {ComplaintStatus.IN_PROGRESS, ComplaintStatus.CLOSED},
    ComplaintStatus.IN_PROGRESS: {ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED},
    ComplaintStatus.RESOLVED: {ComplaintStatus.CLOSED, ComplaintStatus.IN_PROGRESS},
    ComplaintStatus.CLOSED: set(),  # terminal
}


class IllegalTransition(Exception):
    """Raised when a status change is not permitted by the state machine."""

    def __init__(self, current: str, target: str):
        self.current = current
        self.target = target
        super().__init__(f"{current} -> {target}")


class Complaint(BaseModel):
    parent = models.ForeignKey(
        "accounts.ParentProfile", on_delete=models.CASCADE, related_name="complaints"
    )
    # Optional: not every complaint is about a specific child, but staff
    # need to filter by one when it is (brief 16).
    child = models.ForeignKey(
        "children.Child", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="complaints",
    )

    subject = models.CharField(max_length=150)
    message = models.TextField()

    status = models.CharField(
        max_length=12, choices=ComplaintStatus.choices, default=ComplaintStatus.NEW
    )
    assigned_to = models.ForeignKey(
        "accounts.StaffProfile", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="assigned_complaints",
    )
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "complaints_complaint"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["parent", "-created_at"]),
        ]
        verbose_name = "Réclamation"
        verbose_name_plural = "Réclamations"

    def __str__(self) -> str:
        return f"{self.subject} ({self.status})"

    @property
    def is_open(self) -> bool:
        return self.status in (ComplaintStatus.NEW, ComplaintStatus.IN_PROGRESS)

    def can_transition_to(self, target: str) -> bool:
        return target in ALLOWED_TRANSITIONS.get(self.status, set())

    def transition_to(self, target: str, *, by=None) -> None:
        """Move to ``target`` or raise :class:`IllegalTransition`."""
        if target == self.status:
            raise IllegalTransition(self.status, target)
        if not self.can_transition_to(target):
            raise IllegalTransition(self.status, target)

        self.status = target
        # resolved_at tracks when the nursery considered it solved, so it
        # is cleared if the complaint is reopened.
        if target == ComplaintStatus.RESOLVED:
            self.resolved_at = timezone.now()
        elif target == ComplaintStatus.IN_PROGRESS:
            self.resolved_at = None

        if by is not None and self.assigned_to_id is None:
            staff_profile = getattr(by, "staff_profile", None)
            if staff_profile is not None:
                self.assigned_to = staff_profile

        self.save(
            update_fields=["status", "resolved_at", "assigned_to", "updated_at"]
        )


class ComplaintReply(BaseModel):
    complaint = models.ForeignKey(
        Complaint, on_delete=models.CASCADE, related_name="replies"
    )
    author = models.ForeignKey(
        "accounts.User", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="complaint_replies",
    )
    body = models.TextField()
    #: Staff-only working notes. Never serialised to a parent.
    is_internal = models.BooleanField(default=False)

    class Meta:
        db_table = "complaints_complaintreply"
        ordering = ["created_at"]
        indexes = [models.Index(fields=["complaint", "created_at"])]
        verbose_name = "Réponse"
        verbose_name_plural = "Réponses"

    def __str__(self) -> str:
        return f"{'[interne] ' if self.is_internal else ''}{self.body[:40]}"
