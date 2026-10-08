"""The timeline projection must not cost a query per child.

``sync_timeline_events`` used to run a ``DailyRecord`` lookup and a
separate INSERT for every child added, so putting a group of twenty into
one activity cost forty-odd round trips — on a free-tier database reached
over the network, that is the difference between a snappy save and a
visible stall. These tests pin the shape: the cost must not grow with the
size of the group.
"""
from datetime import date, time

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.activities.models import Activity, ActivityParticipation
from apps.activities.services import sync_timeline_events
from apps.care.models import DailyRecord, DailyRecordStatus, TimelineEvent

pytestmark = pytest.mark.django_db


@pytest.fixture
def activity(staff):
    return Activity.objects.create(
        title="Peinture", date=date.today(),
        start_time=time(9, 0), end_time=time(10, 0),
        category="ART", created_by=staff,
    )


def _join(activity, children):
    ActivityParticipation.objects.bulk_create(
        [ActivityParticipation(activity=activity, child=c) for c in children]
    )


def _query_count(fn) -> int:
    with CaptureQueriesContext(connection) as captured:
        fn()
    return len(captured)


def test_cost_does_not_grow_with_the_group(activity, make_child):
    """Twenty children must cost exactly what two do.

    Asserted as an equality between the two runs rather than against a
    hardcoded number: the invariant is that the cost is flat, and pinning
    a literal would break on any unrelated query the service gains.
    """
    two = [make_child(first_name=f"A{i}") for i in range(2)]
    _join(activity, two)
    for_two = _query_count(lambda: sync_timeline_events(activity))

    TimelineEvent.objects.all().delete()
    ActivityParticipation.objects.all().delete()
    _join(activity, two + [make_child(first_name=f"B{i}") for i in range(18)])
    for_twenty = _query_count(lambda: sync_timeline_events(activity))

    assert for_twenty == for_two, (
        f"{for_two} queries for 2 children but {for_twenty} for 20 - "
        "the per-child work is back"
    )
    assert TimelineEvent.objects.filter(activity=activity).count() == 20


def test_local_date_is_still_derived(activity, make_child):
    """bulk_create bypasses save(), where local_date normally comes from."""
    child = make_child()
    _join(activity, [child])
    sync_timeline_events(activity)

    event = TimelineEvent.objects.get(activity=activity, child=child)
    assert event.local_date == activity.date
    assert event.local_date is not None


def test_a_published_day_keeps_a_late_activity_visible(activity, make_child):
    """The per-cohort publish check must agree with the old per-child one."""
    published, draft = make_child(first_name="Pub"), make_child(first_name="Draft")
    DailyRecord.objects.create(
        child=published, date=activity.date, status=DailyRecordStatus.PUBLISHED
    )
    DailyRecord.objects.create(
        child=draft, date=activity.date, status=DailyRecordStatus.DRAFT
    )
    _join(activity, [published, draft])
    sync_timeline_events(activity)

    assert TimelineEvent.objects.get(activity=activity, child=published).is_published
    assert not TimelineEvent.objects.get(activity=activity, child=draft).is_published


def test_moving_the_activity_moves_every_row(activity, make_child):
    children = [make_child(first_name=f"C{i}") for i in range(3)]
    _join(activity, children)
    sync_timeline_events(activity)
    before = {e.occurred_at for e in TimelineEvent.objects.filter(activity=activity)}

    activity.start_time = time(14, 30)
    activity.end_time = time(15, 30)   # the model forbids end < start
    activity.save(update_fields=["start_time", "end_time"])
    sync_timeline_events(activity)

    rows = list(TimelineEvent.objects.filter(activity=activity))
    assert len(rows) == 3
    assert {e.occurred_at for e in rows} != before
    assert len({e.occurred_at for e in rows}) == 1
    # bulk_update bypasses auto_now, so this is set by hand or not at all.
    assert all(e.updated_at is not None for e in rows)


def test_removing_a_child_removes_only_their_row(activity, make_child):
    stays, leaves = make_child(first_name="Stays"), make_child(first_name="Leaves")
    _join(activity, [stays, leaves])
    sync_timeline_events(activity)

    ActivityParticipation.objects.filter(child=leaves).delete()
    sync_timeline_events(activity)

    remaining = list(TimelineEvent.objects.filter(activity=activity))
    assert [e.child_id for e in remaining] == [stays.id]


def test_calling_it_twice_changes_nothing(activity, make_child):
    _join(activity, [make_child()])
    sync_timeline_events(activity)
    first = TimelineEvent.objects.get(activity=activity)

    sync_timeline_events(activity)
    second = TimelineEvent.objects.get(activity=activity)
    assert first.pk == second.pk
