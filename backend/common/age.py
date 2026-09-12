"""Age and age-group computation.

Age is never stored. ``date_of_birth`` is the only stored fact; everything
else here is derived (docs/database.md 4.1).

Two things matter for correctness:

1. Ages use calendar arithmetic (``relativedelta``), not ``days / 30.44``.
   A child born on 31 January is 1 month old on 28 February, and only exact
   calendar arithmetic gets that right.
2. Filtering a list by group must not compute the group row by row in
   Python - that would break pagination and ordering. Instead a group is
   translated into a ``date_of_birth`` range so PostgreSQL can use its
   index. :func:`group_date_range` is that translation, and it is the
   inverse of :func:`age_group_for`; the two are tested against each other.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from dateutil.relativedelta import relativedelta
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext, gettext_lazy as _, ngettext


class AgeGroup(models.TextChoices):
    INFANT = "INFANT", _("2 → 6 mois")
    BABY = "BABY", _("7 mois → 1 an")
    TODDLER = "TODDLER", _("1 → 2 ans")
    PRESCHOOL = "PRESCHOOL", _("2 ans et +")


# Half-open month bounds [lower, upper). ``None`` means unbounded.
#
# The brief's first band starts at 2 months, which leaves 0-2 months
# unclassifiable. INFANT is therefore a catch-all below 7 months so that
# every child always has exactly one group - a newborn must still appear on
# the staff dashboard.
GROUP_BOUNDS: dict[str, tuple[int, int | None]] = {
    AgeGroup.INFANT: (0, 7),
    AgeGroup.BABY: (7, 12),
    AgeGroup.TODDLER: (12, 24),
    AgeGroup.PRESCHOOL: (24, None),
}


def today() -> date:
    """The nursery-local calendar day (settings.TIME_ZONE)."""
    return timezone.localdate()


def age_in_months(date_of_birth: date, on: date | None = None) -> int:
    """Whole months lived, by the calendar."""
    reference = on or today()
    if date_of_birth > reference:
        return 0
    delta = relativedelta(reference, date_of_birth)
    return delta.years * 12 + delta.months


def age_group_for(date_of_birth: date, on: date | None = None) -> str:
    months = age_in_months(date_of_birth, on)
    for group, (lower, upper) in GROUP_BOUNDS.items():
        if months >= lower and (upper is None or months < upper):
            return group
    return AgeGroup.PRESCHOOL  # pragma: no cover - bounds are exhaustive


def age_display(date_of_birth: date, on: date | None = None) -> str:
    """Human-readable age in the request language, e.g. "2 ans et 5 mois".

    Built with ``ngettext`` rather than a French singular/plural ternary:
    Arabic has six plural categories, so "2 ans" is not a plural at all
    there but a dual form, and no amount of `if n == 1` gets that right.
    The two halves are assembled through a translatable template, because
    a language need not join them with a word in the middle or put the
    years first.
    """
    reference = on or today()
    if date_of_birth > reference:
        return ngettext("%(count)d mois", "%(count)d mois", 0) % {"count": 0}

    delta = relativedelta(reference, date_of_birth)
    years, months, days = delta.years, delta.months, delta.days

    if years == 0 and months == 0:
        return ngettext("%(count)d jour", "%(count)d jours", days) % {"count": days}
    if years == 0:
        return ngettext("%(count)d mois", "%(count)d mois", months) % {
            "count": months
        }

    year_part = ngettext("%(count)d an", "%(count)d ans", years) % {"count": years}
    if months == 0:
        return year_part
    month_part = ngettext("%(count)d mois", "%(count)d mois", months) % {
        "count": months
    }
    return gettext("%(years)s et %(months)s") % {
        "years": year_part,
        "months": month_part,
    }


@dataclass(frozen=True)
class DateRange:
    """A ``date_of_birth`` window, exclusive lower / inclusive upper.

    A child is in the group when ``after < date_of_birth <= until``.
    ``None`` means unbounded on that side.
    """

    after: date | None
    until: date | None


def group_date_range(group: str, on: date | None = None) -> DateRange:
    """Translate an age group into a ``date_of_birth`` range predicate.

    Older children were born *earlier*, so the month bounds inverse: an
    upper month bound becomes the lower (earlier) date bound.
    """
    reference = on or today()
    lower_months, upper_months = GROUP_BOUNDS[group]

    # months >= lower_months  ⇔  dob <= reference - lower_months
    until = reference - relativedelta(months=lower_months)
    # months < upper_months   ⇔  dob > reference - upper_months
    after = None if upper_months is None else reference - relativedelta(months=upper_months)

    return DateRange(after=after, until=until)


def filter_queryset_by_group(queryset, group: str, on: date | None = None):
    """Apply the group as an indexed range filter on ``date_of_birth``."""
    if group not in GROUP_BOUNDS:
        return queryset.none()

    date_range = group_date_range(group, on)
    if date_range.after is not None:
        queryset = queryset.filter(date_of_birth__gt=date_range.after)
    if date_range.until is not None:
        queryset = queryset.filter(date_of_birth__lte=date_range.until)
    return queryset


def group_payload(date_of_birth: date, on: date | None = None) -> dict[str, str]:
    group = age_group_for(date_of_birth, on)
    return {"key": group, "label": AgeGroup(group).label}
