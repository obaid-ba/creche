"""Fee resolution, invoice generation and the derived money."""
from datetime import date
from decimal import Decimal

import pytest

from apps.children.models import ChildStatus
from apps.payments.models import Invoice, InvoiceStatus, Payment
from apps.payments.services import (
    default_due_date,
    fee_for,
    first_of_month,
    generate_invoices,
)

pytestmark = pytest.mark.django_db

OCTOBER = date(2026, 10, 1)


def set_fee(child, amount, effective_from=OCTOBER, **kwargs):
    from apps.payments.models import ChildFee

    return ChildFee.objects.create(
        child=child, monthly_amount=Decimal(amount),
        effective_from=effective_from, **kwargs,
    )


def invoice_for(child, amount="180.000", period=OCTOBER, **kwargs):
    return Invoice.objects.create(
        child=child, period=period, amount_due=Decimal(amount),
        due_date=default_due_date(period), **kwargs,
    )


class TestMillimes:
    def test_three_decimal_places_survive(self, make_child):
        """A dinar is 1000 millimes, so 72,500 must round-trip exactly."""
        child = make_child()
        inv = invoice_for(child, "72.500")
        inv.refresh_from_db()
        assert inv.amount_due == Decimal("72.500")

    def test_a_balance_is_exact_not_floating(self, make_child):
        child = make_child()
        inv = invoice_for(child, "180.000")
        Payment.objects.create(
            invoice=inv, amount=Decimal("60.000"), received_on=OCTOBER
        )
        Payment.objects.create(
            invoice=inv, amount=Decimal("60.000"), received_on=OCTOBER
        )
        Payment.objects.create(
            invoice=inv, amount=Decimal("60.000"), received_on=OCTOBER
        )
        # 0.1 + 0.2 != 0.3 in binary floating point; this must be exact.
        assert inv.balance == Decimal("0.000")
        assert inv.status == InvoiceStatus.PAID


class TestFeeHistory:
    def test_no_fee_set_is_none_not_zero(self, make_child):
        """Zero would read as "nothing owed" rather than "not yet priced"."""
        assert fee_for(make_child().id, OCTOBER) is None

    def test_the_fee_in_force_is_the_latest_one_that_has_started(self, make_child):
        child = make_child()
        set_fee(child, "150.000", date(2026, 1, 1))
        set_fee(child, "180.000", date(2026, 9, 1))
        set_fee(child, "200.000", date(2027, 1, 1))  # future

        assert fee_for(child.id, date(2026, 3, 1)) == Decimal("150.000")
        assert fee_for(child.id, date(2026, 10, 1)) == Decimal("180.000")
        assert fee_for(child.id, date(2027, 2, 1)) == Decimal("200.000")

    def test_a_fee_is_snapped_to_the_first_of_the_month(self, make_child):
        fee = set_fee(make_child(), "180.000", date(2026, 10, 17))
        fee.refresh_from_db()
        assert fee.effective_from == date(2026, 10, 1)

    def test_raising_the_fee_does_not_rewrite_an_issued_invoice(self, make_child):
        """The whole reason amount_due is a copy."""
        child = make_child()
        set_fee(child, "150.000", date(2026, 1, 1))
        january = invoice_for(child, period=date(2026, 1, 1), amount="150.000")

        set_fee(child, "200.000", date(2026, 6, 1))

        january.refresh_from_db()
        assert january.amount_due == Decimal("150.000")


class TestGeneration:
    def test_one_invoice_per_active_child(self, make_child):
        a, b = make_child(first_name="A"), make_child(first_name="B")
        set_fee(a, "180.000")
        set_fee(b, "150.000")

        result = generate_invoices(OCTOBER)

        assert result.summary == {
            "created": 2, "already_invoiced": 0, "no_fee_set": 0
        }
        assert Invoice.objects.filter(period=OCTOBER).count() == 2

    def test_running_it_twice_does_not_double_bill(self, make_child):
        child = make_child()
        set_fee(child, "180.000")

        generate_invoices(OCTOBER)
        second = generate_invoices(OCTOBER)

        assert second.summary["created"] == 0
        assert second.summary["already_invoiced"] == 1
        assert Invoice.objects.filter(child=child, period=OCTOBER).count() == 1

    def test_a_child_with_no_fee_is_reported_not_billed_zero(self, make_child):
        priced = make_child(first_name="Priced")
        unpriced = make_child(first_name="Unpriced")
        set_fee(priced, "180.000")

        result = generate_invoices(OCTOBER)

        assert result.summary == {
            "created": 1, "already_invoiced": 0, "no_fee_set": 1
        }
        assert not Invoice.objects.filter(child=unpriced).exists()

    def test_archived_children_are_not_billed(self, make_child):
        active = make_child(first_name="Active")
        gone = make_child(first_name="Gone")
        set_fee(active, "180.000")
        set_fee(gone, "180.000")
        gone.status = ChildStatus.ARCHIVED
        gone.save(update_fields=["status"])

        result = generate_invoices(OCTOBER)

        assert result.summary["created"] == 1
        assert not Invoice.objects.filter(child=gone).exists()

    def test_the_cost_does_not_grow_with_the_roster(
        self, make_child, django_assert_max_num_queries
    ):
        for i in range(25):
            set_fee(make_child(first_name=f"C{i}"), "180.000")

        # A query per child would be 25+; this is a handful of set-based
        # statements regardless of roster size.
        with django_assert_max_num_queries(10):
            generate_invoices(OCTOBER)

        assert Invoice.objects.filter(period=OCTOBER).count() == 25

    def test_the_due_date_lands_inside_the_month_it_bills(self, make_child):
        set_fee(make_child(), "180.000", date(2027, 2, 1))
        result = generate_invoices(date(2027, 2, 1), due_day=10)
        assert result.created[0].due_date == date(2027, 2, 10)

    def test_a_due_day_past_the_end_of_a_short_month_is_clamped(self):
        assert default_due_date(date(2027, 2, 1), day=28) == date(2027, 2, 28)
        assert default_due_date(date(2026, 4, 1), day=28) == date(2026, 4, 28)


class TestStatus:
    def test_unpaid_before_the_due_date(self, make_child):
        inv = invoice_for(make_child(), period=date(2099, 1, 1))
        inv.due_date = date(2099, 1, 10)
        assert inv.status == InvoiceStatus.UNPAID

    def test_overdue_once_the_date_has_passed(self, make_child):
        inv = invoice_for(make_child(), period=date(2020, 1, 1))
        assert inv.status == InvoiceStatus.OVERDUE

    def test_partial_when_some_has_arrived(self, make_child):
        inv = invoice_for(make_child(), "180.000")
        Payment.objects.create(
            invoice=inv, amount=Decimal("50.000"), received_on=OCTOBER
        )
        assert inv.status == InvoiceStatus.PARTIAL
        assert inv.balance == Decimal("130.000")

    def test_overpayment_still_reads_as_paid(self, make_child):
        inv = invoice_for(make_child(), "180.000")
        Payment.objects.create(
            invoice=inv, amount=Decimal("200.000"), received_on=OCTOBER
        )
        assert inv.status == InvoiceStatus.PAID
        assert inv.balance == Decimal("-20.000")

    def test_a_voided_payment_stops_counting(self, make_child, staff):
        inv = invoice_for(make_child(), "180.000")
        payment = Payment.objects.create(
            invoice=inv, amount=Decimal("180.000"), received_on=OCTOBER
        )
        assert inv.status == InvoiceStatus.PAID

        payment.void(reason="Chèque sans provision", by=staff)
        inv = Invoice.objects.get(pk=inv.pk)
        assert inv.amount_paid == Decimal("0.000")
        assert inv.status in (InvoiceStatus.UNPAID, InvoiceStatus.OVERDUE)

    def test_cancelling_wins_over_everything(self, make_child):
        from django.utils import timezone

        inv = invoice_for(make_child(), "180.000")
        Payment.objects.create(
            invoice=inv, amount=Decimal("180.000"), received_on=OCTOBER
        )
        inv.cancelled_at = timezone.now()
        assert inv.status == InvoiceStatus.CANCELLED


def test_first_of_month_normalises():
    assert first_of_month(date(2026, 10, 31)) == date(2026, 10, 1)
