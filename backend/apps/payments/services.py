"""Fee lookup and monthly invoice generation."""
from __future__ import annotations

import calendar
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from django.db import transaction

from apps.children.models import Child, ChildStatus

from .models import ChildFee, Invoice


def first_of_month(value: date) -> date:
    return value.replace(day=1)


def fee_for(child_id, period: date, *, fees=None) -> Decimal | None:
    """The amount in force for ``period``, or None if no fee is set yet.

    ``fees`` lets a caller pass rows it has already fetched, so generating
    a whole month does not run a query per child.
    """
    period = first_of_month(period)
    rows = (
        [f for f in fees if f.child_id == child_id]
        if fees is not None
        else list(ChildFee.objects.filter(child_id=child_id))
    )
    applicable = [f for f in rows if f.effective_from <= period]
    if not applicable:
        return None
    # The latest fee that had started by this month.
    return max(applicable, key=lambda f: f.effective_from).monthly_amount


def default_due_date(period: date, *, day: int = 10) -> date:
    """The 10th of the month being billed, clamped to months that are shorter.

    Not the end of the month: a nursery chases a late fee during the month
    it covers, not after it.
    """
    period = first_of_month(period)
    last = calendar.monthrange(period.year, period.month)[1]
    return period.replace(day=min(day, last))


@dataclass
class GenerationResult:
    created: list[Invoice] = field(default_factory=list)
    already_invoiced: list[str] = field(default_factory=list)
    no_fee_set: list[str] = field(default_factory=list)

    @property
    def summary(self) -> dict:
        return {
            "created": len(self.created),
            "already_invoiced": len(self.already_invoiced),
            "no_fee_set": len(self.no_fee_set),
        }


@transaction.atomic
def generate_invoices(
    period: date, *, issued_by=None, due_day: int = 10
) -> GenerationResult:
    """Issue one invoice per active child for ``period``.

    Idempotent by construction: the unique constraint on (child, period)
    means running it twice cannot double-bill a family, and children who
    already have an invoice are reported rather than skipped silently.

    A child with no fee set is *not* invoiced for zero — that would read
    as "nothing owed" when it actually means "nobody has said what this
    child costs". They are returned so staff can act on it.

    A fixed number of queries regardless of how many children there are.
    """
    period = first_of_month(period)
    result = GenerationResult()

    children = list(
        Child.objects.filter(status=ChildStatus.ACTIVE).only(
            "id", "first_name", "last_name"
        )
    )
    if not children:
        return result

    child_ids = [c.id for c in children]
    fees = list(ChildFee.objects.filter(child_id__in=child_ids))
    existing = set(
        Invoice.all_objects.filter(
            child_id__in=child_ids, period=period
        ).values_list("child_id", flat=True)
    )

    due_date = default_due_date(period, day=due_day)
    to_create: list[Invoice] = []

    for child in children:
        if child.id in existing:
            result.already_invoiced.append(child.full_name)
            continue
        amount = fee_for(child.id, period, fees=fees)
        if amount is None:
            result.no_fee_set.append(child.full_name)
            continue
        to_create.append(
            Invoice(
                child=child,
                period=period,
                amount_due=amount,
                due_date=due_date,
                issued_by=issued_by,
            )
        )

    if to_create:
        # bulk_create skips save(), which is where `period` is snapped to
        # the first of the month - it is already normalised above, so the
        # rows are correct, but this is why that matters.
        result.created = Invoice.objects.bulk_create(to_create)

    return result
