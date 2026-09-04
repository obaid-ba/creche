"""Identity, role and the parent-child link.

One user table with a ``role`` and a role-specific profile, rather than
separate parent/staff authentication systems: a single authentication path
means one place to audit, one password policy, one lockout mechanism, and
no chance of a bug in a second login flow (docs/authentication.md 1).
"""
from __future__ import annotations

from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)
from django.db import models
from django.utils import timezone

from common.models import BaseModel, UUIDModel


class Role(models.TextChoices):
    PARENT = "PARENT", "Parent"
    STAFF = "STAFF", "Personnel"
    ADMIN = "ADMIN", "Administrateur"


class Relationship(models.TextChoices):
    MOTHER = "MOTHER", "Mère"
    FATHER = "FATHER", "Père"
    GUARDIAN = "GUARDIAN", "Tuteur"
    OTHER = "OTHER", "Autre"


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email: str, password: str | None, **extra):
        if not email:
            raise ValueError("Une adresse e-mail est requise.")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str | None = None, **extra):
        extra.setdefault("role", Role.PARENT)
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra)

    def create_staffuser(self, email: str, password: str | None = None, **extra):
        extra.setdefault("role", Role.STAFF)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email: str, password: str | None = None, **extra):
        extra.setdefault("role", Role.ADMIN)
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        if extra.get("is_staff") is not True:
            raise ValueError("Un superuser doit avoir is_staff=True.")
        if extra.get("is_superuser") is not True:
            raise ValueError("Un superuser doit avoir is_superuser=True.")
        return self._create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin, BaseModel):
    email = models.EmailField(unique=True, db_index=True)
    first_name = models.CharField(max_length=80, blank=True)
    last_name = models.CharField(max_length=80, blank=True)
    phone = models.CharField(max_length=30, blank=True)

    # Application authorisation reads this field.
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.PARENT)

    is_active = models.BooleanField(default=True)
    # Django admin access only - deliberately NOT the same as role == STAFF.
    # Conflating the two is a classic privilege-escalation bug.
    is_staff = models.BooleanField(default=False)

    last_login_at = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        db_table = "accounts_user"
        indexes = [models.Index(fields=["role"])]
        verbose_name = "Utilisateur"
        verbose_name_plural = "Utilisateurs"

    def __str__(self) -> str:
        return f"{self.get_full_name()} <{self.email}>"

    def get_full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip() or self.email

    def get_short_name(self) -> str:
        return self.first_name or self.email

    @property
    def is_parent(self) -> bool:
        return self.role == Role.PARENT

    @property
    def is_staff_member(self) -> bool:
        """Staff *or* admin - admin is a superset of staff."""
        return self.role in (Role.STAFF, Role.ADMIN)

    @property
    def is_admin(self) -> bool:
        return self.role == Role.ADMIN


class ParentProfile(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, primary_key=True, related_name="parent_profile"
    )
    address = models.TextField(blank=True)
    emergency_phone = models.CharField(max_length=30, blank=True)
    # Per-nursery policy: the brief allows parents to message "if allowed".
    can_send_messages = models.BooleanField(default=True)
    preferred_language = models.CharField(max_length=5, default="fr")

    class Meta:
        db_table = "accounts_parentprofile"
        verbose_name = "Profil parent"
        verbose_name_plural = "Profils parents"

    def __str__(self) -> str:
        return f"Parent: {self.user.get_full_name()}"


class StaffProfile(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, primary_key=True, related_name="staff_profile"
    )
    job_title = models.CharField(max_length=80, blank=True)
    assigned_age_group = models.CharField(max_length=20, blank=True)
    hired_on = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "accounts_staffprofile"
        verbose_name = "Profil personnel"
        verbose_name_plural = "Profils personnel"

    def __str__(self) -> str:
        return f"Personnel: {self.user.get_full_name()}"


class GuardianshipQuerySet(models.QuerySet):
    def active(self):
        return self.filter(revoked_at__isnull=True)


class Guardianship(BaseModel):
    """The only thing that grants a parent access to a child.

    All parent authorisation derives from this table, so it is deliberately
    small and explicit. Revocation is soft (``revoked_at``) to keep the
    historical record while removing access immediately.
    """

    parent = models.ForeignKey(
        ParentProfile, on_delete=models.CASCADE, related_name="guardianships"
    )
    child = models.ForeignKey(
        "children.Child", on_delete=models.CASCADE, related_name="guardianships"
    )
    relationship = models.CharField(
        max_length=20, choices=Relationship.choices, default=Relationship.GUARDIAN
    )
    is_primary = models.BooleanField(default=False)
    granted_at = models.DateTimeField(default=timezone.now)
    revoked_at = models.DateTimeField(null=True, blank=True)
    granted_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    objects = GuardianshipQuerySet.as_manager()

    class Meta:
        db_table = "accounts_guardianship"
        constraints = [
            models.UniqueConstraint(
                fields=["parent", "child"], name="uniq_guardianship_parent_child"
            ),
            models.UniqueConstraint(
                fields=["child"],
                condition=models.Q(is_primary=True, revoked_at__isnull=True),
                name="uniq_primary_guardian_per_child",
            ),
        ]
        indexes = [
            # The hot authorisation lookup - every parent request uses it.
            models.Index(
                fields=["parent"],
                condition=models.Q(revoked_at__isnull=True),
                name="idx_guardianship_active_parent",
            ),
            models.Index(
                fields=["child"],
                condition=models.Q(revoked_at__isnull=True),
                name="idx_guardianship_active_child",
            ),
        ]
        verbose_name = "Lien de garde"
        verbose_name_plural = "Liens de garde"

    def __str__(self) -> str:
        return f"{self.parent.user.get_full_name()} → {self.child}"

    @property
    def is_active(self) -> bool:
        return self.revoked_at is None

    def revoke(self) -> None:
        self.revoked_at = timezone.now()
        self.is_primary = False
        self.save(update_fields=["revoked_at", "is_primary", "updated_at"])
