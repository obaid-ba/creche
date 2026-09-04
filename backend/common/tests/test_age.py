"""Age and age-group boundary tests (brief 27, docs/database.md 4.1).

Age drives which group a child appears in on the staff dashboard, so an
off-by-one here puts a child in the wrong room's list. The boundaries are
tested exactly rather than approximately.
"""
from datetime import date

import pytest

from common.age import (
    AgeGroup,
    DateRange,
    age_display,
    age_group_for,
    age_in_months,
    group_date_range,
)

REF = date(2026, 9, 4)


class TestAgeInMonths:
    @pytest.mark.parametrize(
        ("dob", "expected"),
        [
            (date(2026, 9, 4), 0),    # born today
            (date(2026, 8, 5), 0),    # 30 days, not yet a full month
            (date(2026, 8, 4), 1),    # exactly one month
            (date(2026, 3, 4), 6),
            (date(2025, 9, 4), 12),   # exactly one year
            (date(2025, 9, 5), 11),   # one day short of a year
            (date(2024, 9, 4), 24),   # exactly two years
            (date(2024, 9, 5), 23),   # one day short of two years
        ],
    )
    def test_calendar_arithmetic(self, dob, expected):
        assert age_in_months(dob, on=REF) == expected

    def test_month_end_birthday_does_not_overflow(self):
        """31 Jan → 28 Feb is one month, not zero and not two."""
        assert age_in_months(date(2026, 1, 31), on=date(2026, 2, 28)) == 1

    def test_leap_day_birthday(self):
        """A 29 Feb baby turns 1 on 28 Feb in a non-leap year.

        relativedelta clamps the day to the end of a shorter month, which
        matches the conventional reading: the child does not wait until
        1 March, nor until the next leap year, to be a year old.
        """
        assert age_in_months(date(2024, 2, 29), on=date(2025, 2, 27)) == 11
        assert age_in_months(date(2024, 2, 29), on=date(2025, 2, 28)) == 12
        assert age_in_months(date(2024, 2, 29), on=date(2025, 3, 1)) == 12

    def test_future_birth_clamps_to_zero(self):
        assert age_in_months(date(2027, 1, 1), on=REF) == 0


class TestAgeGroupBoundaries:
    @pytest.mark.parametrize(
        ("months_old", "expected"),
        [
            (0, AgeGroup.INFANT),      # newborn - catch-all, see docs
            (1, AgeGroup.INFANT),
            (6, AgeGroup.INFANT),
            (7, AgeGroup.BABY),        # lower edge
            (11, AgeGroup.BABY),
            (12, AgeGroup.TODDLER),    # exactly 1 year
            (23, AgeGroup.TODDLER),
            (24, AgeGroup.PRESCHOOL),  # exactly 2 years
            (60, AgeGroup.PRESCHOOL),
        ],
    )
    def test_each_boundary(self, months_old, expected):
        from dateutil.relativedelta import relativedelta

        dob = REF - relativedelta(months=months_old)
        assert age_group_for(dob, on=REF) == expected

    def test_every_age_has_exactly_one_group(self):
        """No gaps and no overlaps across the first six years."""
        from dateutil.relativedelta import relativedelta

        for months in range(0, 72):
            dob = REF - relativedelta(months=months)
            group = age_group_for(dob, on=REF)
            assert group in AgeGroup.values, f"{months} months → no group"

    def test_birthday_transition_is_exact(self):
        """A child turning 1 today is TODDLER; yesterday they were BABY."""
        assert age_group_for(date(2025, 9, 4), on=REF) == AgeGroup.TODDLER
        assert age_group_for(date(2025, 9, 5), on=REF) == AgeGroup.BABY


class TestGroupDateRange:
    """group_date_range must be the exact inverse of age_group_for.

    List filtering uses the range (so PostgreSQL can use the
    date_of_birth index) while the serializer uses age_group_for. If the
    two ever disagree, a child would be filtered into one group and
    labelled another - so they are checked against each other directly.
    """

    @pytest.mark.parametrize("group", list(AgeGroup.values))
    def test_range_agrees_with_direct_computation(self, group):
        from dateutil.relativedelta import relativedelta

        date_range = group_date_range(group, on=REF)
        for months in range(0, 72):
            dob = REF - relativedelta(months=months)
            in_range = (
                (date_range.after is None or dob > date_range.after)
                and (date_range.until is None or dob <= date_range.until)
            )
            assert in_range == (age_group_for(dob, on=REF) == group), (
                f"{group}: {months} months disagrees"
            )

    def test_preschool_is_unbounded_below(self):
        assert group_date_range(AgeGroup.PRESCHOOL, on=REF).after is None

    def test_returns_date_range(self):
        assert isinstance(group_date_range(AgeGroup.BABY, on=REF), DateRange)


class TestAgeDisplay:
    @pytest.mark.parametrize(
        ("dob", "expected"),
        [
            (date(2026, 9, 3), "1 jour"),
            (date(2026, 9, 1), "3 jours"),
            (date(2026, 8, 4), "1 mois"),
            (date(2026, 4, 4), "5 mois"),
            (date(2025, 9, 4), "1 an"),
            (date(2025, 8, 4), "1 an et 1 mois"),
            (date(2024, 4, 4), "2 ans et 5 mois"),
            (date(2024, 9, 4), "2 ans"),
        ],
    )
    def test_french_formatting(self, dob, expected):
        assert age_display(dob, on=REF) == expected
