"""Base models shared across apps."""
import uuid

from django.db import models
from django.utils import timezone


class UUIDModel(models.Model):
    """UUID primary key.

    Sequential integers would leak how many children the nursery has and
    make id enumeration trivial, so every resource is addressed by UUID
    (docs/api.md 1).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class BaseModel(UUIDModel, TimeStampedModel):
    class Meta:
        abstract = True


class SoftDeleteQuerySet(models.QuerySet):
    def alive(self):
        return self.filter(archived_at__isnull=True)

    def archived(self):
        return self.filter(archived_at__isnull=False)


class SoftDeleteManager(models.Manager):
    """Default manager that hides archived rows.

    Models using this must also expose ``all_objects`` so staff restore
    flows can still reach archived records - archiving is reversible, and
    an unreachable row would make that impossible.
    """

    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db).alive()


class SoftDeleteModel(models.Model):
    """Archive instead of delete.

    Nursery records carry legal and emotional weight, so nothing important
    is hard-deleted by default (docs/architecture.md 2).
    """

    archived_at = models.DateTimeField(null=True, blank=True, db_index=True)
    archived_by = models.ForeignKey(
        "accounts.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    objects = SoftDeleteManager()
    all_objects = models.Manager()

    class Meta:
        abstract = True

    def archive(self, *, by=None) -> None:
        self.archived_at = timezone.now()
        self.archived_by = by
        self.save(update_fields=["archived_at", "archived_by", "updated_at"])

    def restore(self) -> None:
        self.archived_at = None
        self.archived_by = None
        self.save(update_fields=["archived_at", "archived_by", "updated_at"])

    @property
    def is_archived(self) -> bool:
        return self.archived_at is not None
