"""The Child record.

``date_of_birth`` is the only age fact stored; age and age group are always
computed (docs/database.md 4.1). Children are archived, never deleted by
default.
"""
from __future__ import annotations

from django.db import models

from common.age import age_display, age_group_for, age_in_months, group_payload
from common.models import BaseModel, SoftDeleteQuerySet


class ChildStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Actif"
    ARCHIVED = "ARCHIVED", "Archivé"
    WAITLIST = "WAITLIST", "Liste d'attente"


class Gender(models.TextChoices):
    MALE = "M", "Garçon"
    FEMALE = "F", "Fille"
    OTHER = "OTHER", "Autre"


class ChildQuerySet(SoftDeleteQuerySet):
    def visible_to(self, user):
        """The single source of truth for who may see which children.

        A ``child_id`` from the client is never used to decide access - it
        is only ever looked up *within* this queryset. A parent passing
        another family's id therefore gets a genuine "not found"
        (docs/authentication.md 5).
        """
        if not user or not user.is_authenticated:
            return self.none()
        if user.is_staff_member:
            return self
        if user.is_parent:
            parent_profile = getattr(user, "parent_profile", None)
            if parent_profile is None:
                return self.none()
            return self.filter(
                guardianships__parent=parent_profile,
                guardianships__revoked_at__isnull=True,
            ).distinct()
        return self.none()

    def in_age_group(self, group: str, on=None):
        from common.age import filter_queryset_by_group

        return filter_queryset_by_group(self, group, on)


class ChildManager(models.Manager):
    """Hides archived children by default; ``all_objects`` reaches them."""

    def get_queryset(self):
        return ChildQuerySet(self.model, using=self._db).filter(
            archived_at__isnull=True
        )

    def visible_to(self, user):
        return self.get_queryset().visible_to(user)


class Child(BaseModel):
    first_name = models.CharField(max_length=80)
    last_name = models.CharField(max_length=80)
    date_of_birth = models.DateField(db_index=True)
    gender = models.CharField(max_length=10, choices=Gender.choices, blank=True)
    photo = models.ImageField(upload_to="children/photos/", null=True, blank=True)
    registration_date = models.DateField(null=True, blank=True)

    allergies = models.TextField(blank=True)
    medical_notes = models.TextField(blank=True)  # staff-only serializer field
    notes = models.TextField(blank=True)

    status = models.CharField(
        max_length=12, choices=ChildStatus.choices, default=ChildStatus.ACTIVE
    )
    archived_at = models.DateTimeField(null=True, blank=True, db_index=True)
    archived_by = models.ForeignKey(
        "accounts.User", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )

    objects = ChildManager()
    all_objects = ChildQuerySet.as_manager()

    class Meta:
        db_table = "children_child"
        ordering = ["last_name", "first_name"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(date_of_birth__lte=models.functions.Now()),
                name="child_dob_not_in_future",
            ),
            # status and the timestamp can never disagree
            models.CheckConstraint(
                condition=(
                    models.Q(status="ARCHIVED", archived_at__isnull=False)
                    | ~models.Q(status="ARCHIVED") & models.Q(archived_at__isnull=True)
                ),
                name="child_archived_status_consistent",
            ),
        ]
        indexes = [
            models.Index(fields=["last_name", "first_name"]),
            models.Index(
                fields=["status"],
                condition=models.Q(status="ACTIVE"),
                name="idx_child_active",
            ),
        ]
        verbose_name = "Enfant"
        verbose_name_plural = "Enfants"

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}"

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    # ── Derived, never stored ───────────────────────────────────────────
    @property
    def age_months(self) -> int:
        return age_in_months(self.date_of_birth)

    @property
    def age_display(self) -> str:
        return age_display(self.date_of_birth)

    @property
    def age_group(self) -> str:
        return age_group_for(self.date_of_birth)

    @property
    def age_group_payload(self) -> dict[str, str]:
        return group_payload(self.date_of_birth)

    @property
    def is_archived(self) -> bool:
        return self.archived_at is not None

    def archive(self, *, by=None) -> None:
        from django.utils import timezone

        self.archived_at = timezone.now()
        self.archived_by = by
        self.status = ChildStatus.ARCHIVED
        self.save(update_fields=["archived_at", "archived_by", "status", "updated_at"])

    def restore(self) -> None:
        self.archived_at = None
        self.archived_by = None
        self.status = ChildStatus.ACTIVE
        self.save(update_fields=["archived_at", "archived_by", "status", "updated_at"])
