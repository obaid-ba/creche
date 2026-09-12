"""Child access codes (``MAM-7F42K``).

The code is an **enrolment token, not a password**: it links a parent to a
child exactly once, after which the parent signs in with email + password.
Full reasoning in docs/authentication.md 4.1 - in short, ~25 bits of entropy
is fine for a single-use, rate-limited, expiring code and far too weak to
guard a child's records indefinitely.

Storage: the plaintext is never persisted. Only a keyed HMAC is stored.
HMAC rather than a salted password hash **because the value must stay
indexable** - the claim endpoint needs an O(1) lookup, and per-row salts
would force a full-table scan. The key lives in the environment, so a
database leak alone does not let an attacker match codes.
"""
from __future__ import annotations

import hmac
import secrets
from datetime import timedelta
from hashlib import sha256

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from common.models import BaseModel

# 31 symbols. 0/O and 1/I/L are excluded because the code is read off paper
# and typed by a parent: ambiguous glyphs cause support calls, not security.
# secrets.choice is unbiased for any alphabet size, so 31 is fine.
CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
CODE_LENGTH = 5


def generate_plain_code() -> str:
    """``MAM-7F42K`` using a CSPRNG (``secrets``, never ``random``)."""
    body = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
    return f"{settings.ACCESS_CODE_PREFIX}-{body}"


def normalise_code(raw: str) -> str:
    """Accept what a human plausibly types: ``mam 7f42k`` → ``MAM-7F42K``."""
    cleaned = "".join(ch for ch in (raw or "").upper() if ch.isalnum())
    prefix = settings.ACCESS_CODE_PREFIX.upper()
    if cleaned.startswith(prefix):
        cleaned = cleaned[len(prefix):]
    return f"{prefix}-{cleaned}"


def code_lookup_hash(raw: str) -> str:
    """Keyed HMAC of the normalised code - the only stored form."""
    return hmac.new(
        settings.ACCESS_CODE_HMAC_KEY.encode(),
        normalise_code(raw).encode(),
        sha256,
    ).hexdigest()


def code_hint(plain: str) -> str:
    """``MAM-7F…`` - lets staff tell two codes apart without storing either."""
    return f"{plain[:6]}…"


class ChildAccessCodeQuerySet(models.QuerySet):
    def usable(self):
        return self.filter(
            claimed_at__isnull=True,
            revoked_at__isnull=True,
            expires_at__gt=timezone.now(),
        )


class ChildAccessCode(BaseModel):
    child = models.ForeignKey(
        "children.Child", on_delete=models.CASCADE, related_name="access_codes"
    )
    code_lookup = models.CharField(max_length=64, unique=True, db_index=True)
    code_hint = models.CharField(max_length=10, blank=True)

    issued_by = models.ForeignKey(
        "accounts.User", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="+",
    )
    issued_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()

    claimed_at = models.DateTimeField(null=True, blank=True)
    claimed_by = models.ForeignKey(
        "accounts.ParentProfile", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="claimed_codes",
    )
    revoked_at = models.DateTimeField(null=True, blank=True)

    objects = ChildAccessCodeQuerySet.as_manager()

    class Meta:
        db_table = "accounts_childaccesscode"
        constraints = [
            # At most one live code per child: regenerating revokes the old one.
            models.UniqueConstraint(
                fields=["child"],
                condition=models.Q(claimed_at__isnull=True, revoked_at__isnull=True),
                name="uniq_live_access_code_per_child",
            ),
        ]
        verbose_name = "Code d'accès enfant"
        verbose_name_plural = "Codes d'accès enfant"

    def __str__(self) -> str:
        return f"{self.code_hint} → {self.child_id}"

    @property
    def is_expired(self) -> bool:
        return self.expires_at <= timezone.now()

    @property
    def is_usable(self) -> bool:
        return (
            self.claimed_at is None
            and self.revoked_at is None
            and not self.is_expired
        )

    def revoke(self) -> None:
        self.revoked_at = timezone.now()
        self.save(update_fields=["revoked_at", "updated_at"])

    @classmethod
    def issue(cls, *, child, issued_by=None) -> tuple["ChildAccessCode", str]:
        """Revoke any live code for the child and issue a new one.

        Returns ``(instance, plaintext)``. The plaintext exists only here and
        in the HTTP response that follows; it is never stored or logged.
        """
        cls.objects.filter(
            child=child, claimed_at__isnull=True, revoked_at__isnull=True
        ).update(revoked_at=timezone.now())

        for _ in range(10):  # retry on the (vanishingly rare) collision
            plain = generate_plain_code()
            lookup = code_lookup_hash(plain)
            if not cls.objects.filter(code_lookup=lookup).exists():
                break
        else:  # pragma: no cover - implies a broken CSPRNG
            raise RuntimeError(_("Impossible de générer un code unique."))

        instance = cls.objects.create(
            child=child,
            code_lookup=lookup,
            code_hint=code_hint(plain),
            issued_by=issued_by,
            expires_at=timezone.now() + timedelta(days=settings.ACCESS_CODE_TTL_DAYS),
        )
        return instance, plain

    @classmethod
    def resolve(cls, raw: str) -> "ChildAccessCode | None":
        """Look up a usable code, or ``None``.

        Callers must return an identical error for every ``None`` case -
        missing, expired, claimed and revoked must be indistinguishable, or
        the endpoint becomes an oracle for which codes exist.
        """
        try:
            candidate = cls.objects.select_related("child").get(
                code_lookup=code_lookup_hash(raw)
            )
        except cls.DoesNotExist:
            return None
        return candidate if candidate.is_usable else None
