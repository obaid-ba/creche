"""Fees, invoices and payments — an internal ledger, not a payment gateway.

Families pay cash, by transfer or by cheque; staff record what arrived.
Nothing here talks to a card processor, so the application never holds
card data and has no PCI scope. A gateway could be added later as another
``PaymentMethod`` plus a provider reference, without reshaping any of
this.

Three rules shape the schema:

**Money is exact.** Every amount is a ``Decimal`` with three decimal
places, because the Tunisian dinar divides into 1000 millimes — 72,500 TND
is a real price, not a rounding artefact. Floats are never used.

**An issued invoice does not change retroactively.** The monthly fee lives
in its own dated table, and issuing an invoice *copies* the amount in
force that month. Raising the fee in March must not silently rewrite what
a family owed in January.

**Financial records are not deleted.** A mistaken payment is voided, which
keeps the row and the reason. ``SoftDeleteModel`` gives the same
behaviour the rest of the project uses for children.
"""
from __future__ import annotations

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from common.models import BaseModel, SoftDeleteModel

#: Three decimal places: 1 dinar = 1000 millimes.
MILLIME = Decimal("0.001")

#: Shared by every amount column so none of them drifts.
MONEY = {"max_digits": 10, "decimal_places": 3}


class PaymentMethod(models.TextChoices):
    CASH = "CASH", _("Espèces")
    TRANSFER = "TRANSFER", _("Virement")
    CHEQUE = "CHEQUE", _("Chèque")
    OTHER = "OTHER", _("Autre")


class InvoiceStatus(models.TextChoices):
    """Derived from the payments against an invoice, never set by hand.

    Kept as choices rather than a stored column so it cannot contradict
    the payment rows — the one thing a reader of a ledger must be able to
    trust.
    """

    UNPAID = "UNPAID", _("Impayée")
    PARTIAL = "PARTIAL", _("Partiellement payée")
    PAID = "PAID", _("Payée")
    OVERDUE = "OVERDUE", _("En retard")
    CANCELLED = "CANCELLED", _("Annulée")


def month_start(value) -> "models.DateField":
    """Normalise any date to the first of its month."""
    return value.replace(day=1)


class ChildFee(BaseModel):
    """What one child's month costs, from a given month onward.

    A dated history rather than a single column on ``Child``: fees change,
    siblings are charged differently, and an invoice issued last January
    has to keep saying what it said. The fee in force for a month is the
    most recent row whose ``effective_from`` is not after it.
    """

    child = models.ForeignKey(
        "children.Child", on_delete=models.CASCADE, related_name="fees"
    )
    monthly_amount = models.DecimalField(
        **MONEY, validators=[MinValueValidator(Decimal("0"))]
    )
    #: Always the first of a month; enforced in save().
    effective_from = models.DateField(db_index=True)
    note = models.CharField(max_length=200, blank=True)
    created_by = models.ForeignKey(
        "accounts.User", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )

    class Meta:
        db_table = "payments_childfee"
        ordering = ["-effective_from"]
        constraints = [
            models.UniqueConstraint(
                fields=["child", "effective_from"], name="uniq_child_fee_month"
            ),
            models.CheckConstraint(
                condition=models.Q(monthly_amount__gte=0),
                name="child_fee_not_negative",
            ),
        ]
        verbose_name = "Tarif mensuel"
        verbose_name_plural = "Tarifs mensuels"

    def save(self, *args, **kwargs):
        # A fee that starts mid-month has no meaning here: invoicing is
        # monthly, so the date is snapped rather than rejected.
        if self.effective_from is not None:
            self.effective_from = self.effective_from.replace(day=1)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.child_id} · {self.monthly_amount} from {self.effective_from}"


class Invoice(SoftDeleteModel, BaseModel):
    """One month, one child, one amount owed.

    ``amount_due`` is a copy taken when the invoice is issued, not a
    lookup through ``ChildFee`` — see the module docstring.
    """

    child = models.ForeignKey(
        "children.Child", on_delete=models.PROTECT, related_name="invoices"
    )
    #: First day of the month being billed.
    period = models.DateField(db_index=True)
    amount_due = models.DecimalField(
        **MONEY, validators=[MinValueValidator(Decimal("0"))]
    )
    due_date = models.DateField()
    note = models.CharField(max_length=200, blank=True)

    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_reason = models.CharField(max_length=200, blank=True)

    issued_by = models.ForeignKey(
        "accounts.User", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )

    class Meta:
        db_table = "payments_invoice"
        ordering = ["-period", "child__last_name"]
        constraints = [
            # One invoice per child per month. Generating a month twice
            # must not double-bill a family.
            models.UniqueConstraint(
                fields=["child", "period"], name="uniq_invoice_child_period"
            ),
            models.CheckConstraint(
                condition=models.Q(amount_due__gte=0), name="invoice_not_negative"
            ),
        ]
        indexes = [models.Index(fields=["-period", "child"])]
        verbose_name = "Facture"
        verbose_name_plural = "Factures"

    def save(self, *args, **kwargs):
        if self.period is not None:
            self.period = self.period.replace(day=1)
        super().save(*args, **kwargs)

    # ── Derived money ───────────────────────────────────────────────────
    # These read `self.payments`, so a caller listing invoices must
    # prefetch it or pay a query per row.

    @property
    def amount_paid(self) -> Decimal:
        """Voided payments do not count, which is the point of voiding."""
        return sum(
            (p.amount for p in self.payments.all() if p.voided_at is None),
            Decimal("0.000"),
        )

    @property
    def balance(self) -> Decimal:
        return (self.amount_due - self.amount_paid).quantize(MILLIME)

    @property
    def status(self) -> str:
        if self.cancelled_at is not None:
            return InvoiceStatus.CANCELLED
        paid = self.amount_paid
        if paid >= self.amount_due:
            return InvoiceStatus.PAID
        if paid > 0:
            return InvoiceStatus.PARTIAL
        if self.due_date < timezone.localdate():
            return InvoiceStatus.OVERDUE
        return InvoiceStatus.UNPAID

    def __str__(self) -> str:
        return f"{self.child_id} · {self.period:%Y-%m} · {self.amount_due}"


class Payment(BaseModel):
    """Money that actually arrived, against one invoice.

    Several payments may sit against one invoice: a family paying in two
    instalments is normal, so partial payment is the default case rather
    than an exception.

    Never edited and never deleted — a mistake is voided, leaving the
    original row and the reason in place. A ledger that can be quietly
    rewritten is not a ledger.
    """

    invoice = models.ForeignKey(
        Invoice, on_delete=models.PROTECT, related_name="payments"
    )
    amount = models.DecimalField(
        **MONEY, validators=[MinValueValidator(Decimal("0.001"))]
    )
    method = models.CharField(
        max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.CASH
    )
    received_on = models.DateField(db_index=True)
    #: Cheque number, transfer reference — whatever ties this row to paper.
    reference = models.CharField(max_length=100, blank=True)
    note = models.CharField(max_length=200, blank=True)

    voided_at = models.DateTimeField(null=True, blank=True)
    voided_reason = models.CharField(max_length=200, blank=True)
    voided_by = models.ForeignKey(
        "accounts.User", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )

    recorded_by = models.ForeignKey(
        "accounts.User", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )

    class Meta:
        db_table = "payments_payment"
        ordering = ["-received_on", "-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=0), name="payment_amount_positive"
            ),
            # Voiding must say why: an unexplained reversal in a financial
            # record is worse than no reversal at all.
            models.CheckConstraint(
                condition=models.Q(voided_at__isnull=True)
                | ~models.Q(voided_reason=""),
                name="voided_payment_has_a_reason",
            ),
        ]
        indexes = [models.Index(fields=["invoice", "-received_on"])]
        verbose_name = "Paiement"
        verbose_name_plural = "Paiements"

    @property
    def is_voided(self) -> bool:
        return self.voided_at is not None

    def void(self, *, reason: str, by=None) -> None:
        self.voided_at = timezone.now()
        self.voided_reason = reason
        self.voided_by = by
        self.save(update_fields=["voided_at", "voided_reason", "voided_by",
                                 "updated_at"])

    def __str__(self) -> str:
        return f"{self.amount} · {self.get_method_display()} · {self.received_on}"
