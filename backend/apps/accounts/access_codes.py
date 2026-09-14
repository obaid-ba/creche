"""Parent access codes (``MAM-7F42-K9QX``).

The code **is** the parent's credential. Parents never register
themselves and never choose a password: staff create the account from the
paper enrolment form, and the parent signs in with this code plus their
child's first name.

That makes the code a long-lived key rather than the one-shot enrolment
ticket it used to be, and it is sized accordingly: 8 characters over a
31-symbol alphabet is ~40 bits, about 30,000x the old 5-character code.
It does not expire while the child is enrolled, it survives being used,
and staff can revoke and reissue it the moment a paper goes missing.

The child's first name is a second factor only in the weakest sense —
other families know the children's names — so the code carries the
security on its own. What the name buys is that a code glimpsed on a desk
is not immediately a working login, and that a mistyped code fails
without revealing whether it exists.

Storage: the plaintext is never persisted. Only a keyed HMAC is stored.
HMAC rather than a salted password hash **because the value must stay
indexable** - the claim endpoint needs an O(1) lookup, and per-row salts
would force a full-table scan. The key lives in the environment, so a
database leak alone does not let an attacker match codes.
"""
from __future__ import annotations

import hmac
import secrets
import unicodedata
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

# 31**8 = 852,891,037,441 ≈ 2**39.6. The old 5-character code was ~25 bits,
# which was right for something used once and thrown away and far too thin
# for a credential that now opens a child's records for years.
CODE_LENGTH = 8

#: Printed in groups of four. A twelve-character run off a sheet of paper
#: is where transcription errors come from, not the alphabet.
CODE_GROUP = 4


def generate_plain_code() -> str:
    """``MAM-7F42-K9QX`` using a CSPRNG (``secrets``, never ``random``)."""
    body = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
    groups = [body[i:i + CODE_GROUP] for i in range(0, len(body), CODE_GROUP)]
    return "-".join([settings.ACCESS_CODE_PREFIX, *groups])


def normalise_code(raw: str) -> str:
    """Accept what a human plausibly types: ``mam 7f42k`` → ``MAM-7F42K``."""
    cleaned = "".join(ch for ch in (raw or "").upper() if ch.isalnum())
    prefix = settings.ACCESS_CODE_PREFIX.upper()
    if cleaned.startswith(prefix):
        cleaned = cleaned[len(prefix):]
    return f"{prefix}-{cleaned}"


def fold_name(raw: str) -> str:
    """Compare names the way a tired parent types them.

    Accents, case and stray spacing are all noise here: "Mohamed",
    "mohamed" and "MOHAMED " are the same child, and a parent typing on a
    phone keyboard without accents should not be locked out of their own
    account over a "é".
    """
    decomposed = unicodedata.normalize("NFKD", (raw or "").strip())
    stripped = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return " ".join(stripped.casefold().split())


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
        """Live codes. Being used does not spend one any more."""
        return self.filter(revoked_at__isnull=True)


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

    #: The parent this code signs in. One code per guardian, so a mother
    #: and a father each get their own and one can be revoked alone.
    parent = models.ForeignKey(
        "accounts.ParentProfile", null=True, blank=True,
        on_delete=models.CASCADE, related_name="access_codes",
    )

    last_used_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    #: Consecutive failed attempts against this specific code. A permanent
    #: credential needs a lockout of its own: throttling by IP alone lets
    #: a botnet grind one code from a thousand addresses.
    failed_attempts = models.PositiveIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)

    objects = ChildAccessCodeQuerySet.as_manager()

    class Meta:
        db_table = "accounts_childaccesscode"
        constraints = [
            # One live code per parent per child: reissuing revokes the old.
            models.UniqueConstraint(
                fields=["child", "parent"],
                condition=models.Q(revoked_at__isnull=True),
                name="uniq_live_access_code_per_guardian",
            ),
        ]
        verbose_name = "Code d'accès parent"
        verbose_name_plural = "Codes d'accès parent"

    def __str__(self) -> str:
        return f"{self.code_hint} → {self.child_id}"

    @property
    def is_locked(self) -> bool:
        return self.locked_until is not None and self.locked_until > timezone.now()

    @property
    def is_usable(self) -> bool:
        """Live and not locked. A code is not spent by being used."""
        return self.revoked_at is None and not self.is_locked

    def revoke(self) -> None:
        self.revoked_at = timezone.now()
        self.save(update_fields=["revoked_at", "updated_at"])

    @classmethod
    def issue(cls, *, child, parent, issued_by=None) -> tuple["ChildAccessCode", str]:
        """Revoke this guardian's live code and issue a new one.

        Returns ``(instance, plaintext)``. The plaintext exists only here and
        in the HTTP response that follows; it is never stored or logged, so
        a lost paper means reissuing, never recovering.
        """
        cls.objects.filter(
            child=child, parent=parent, revoked_at__isnull=True
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
            parent=parent,
            code_lookup=lookup,
            code_hint=code_hint(plain),
            issued_by=issued_by,
        )
        return instance, plain

    @classmethod
    def resolve(cls, raw: str) -> "ChildAccessCode | None":
        """Look up a usable code, or ``None``.

        Callers must return an identical error for every ``None`` case -
        missing, revoked and locked must be indistinguishable, or the
        endpoint becomes an oracle for which codes exist.
        """
        try:
            candidate = cls.objects.select_related(
                "child", "parent", "parent__user"
            ).get(code_lookup=code_lookup_hash(raw))
        except cls.DoesNotExist:
            return None
        return candidate if candidate.is_usable else None

    def register_failure(self) -> None:
        """Count a wrong attempt, and lock the code once they pile up.

        Locking the credential rather than only the caller's address is
        the point: a permanent code is worth grinding, and an attacker
        with many addresses defeats an IP throttle on its own.
        """
        self.failed_attempts += 1
        fields = ["failed_attempts", "updated_at"]
        if self.failed_attempts >= settings.ACCESS_CODE_MAX_ATTEMPTS:
            self.locked_until = timezone.now() + timedelta(
                minutes=settings.ACCESS_CODE_LOCKOUT_MINUTES
            )
            self.failed_attempts = 0
            fields.append("locked_until")
        self.save(update_fields=fields)

    def register_success(self) -> None:
        self.failed_attempts = 0
        self.locked_until = None
        self.last_used_at = timezone.now()
        self.save(
            update_fields=["failed_attempts", "locked_until", "last_used_at", "updated_at"]
        )
