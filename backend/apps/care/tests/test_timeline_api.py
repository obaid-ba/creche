"""Timeline endpoint tests (brief 27, docs/timeline.md 6)."""
from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.care.models import DailyRecord, TimelineEvent


def timeline_url(child):
    return reverse("child-timeline", args=[child.id])


@pytest.mark.django_db
class TestOwnership:
    def test_parent_cannot_read_another_childs_timeline(
        self, api_client, parent, other_parent, make_child,
        link_parent_to_child, make_event,
    ):
        theirs = make_child(first_name="Yasmine")
        link_parent_to_child(other_parent, theirs)
        make_event(theirs)
        api_client.force_authenticate(parent)

        response = api_client.get(timeline_url(theirs))

        assert response.status_code == 404

    def test_parent_reads_their_own_childs_timeline(
        self, api_client, parent, owned_child, make_event
    ):
        make_event(owned_child)
        api_client.force_authenticate(parent)

        response = api_client.get(timeline_url(owned_child))

        assert response.status_code == 200
        assert response.data["count"] == 1

    def test_parent_cannot_record_an_event(
        self, api_client, parent, owned_child
    ):
        api_client.force_authenticate(parent)

        response = api_client.post(
            timeline_url(owned_child),
            {
                "type": "BOTTLE",
                "occurred_at": timezone.now().isoformat(),
                "data": {"volume_ml": 180},
            },
        )

        assert response.status_code == 403
        assert TimelineEvent.objects.count() == 0

    def test_staff_can_read_any_childs_timeline(
        self, api_client, staff, make_child, make_event
    ):
        child = make_child()
        make_event(child)
        api_client.force_authenticate(staff)

        assert api_client.get(timeline_url(child)).status_code == 200

    def test_anonymous_is_rejected(self, api_client, make_child):
        assert api_client.get(timeline_url(make_child())).status_code == 401


@pytest.mark.django_db
class TestOrdering:
    def test_events_are_ordered_by_when_they_happened(
        self, api_client, staff, make_child, make_event
    ):
        """Not by created_at: staff record a 10:30 nap at 11:15."""
        child = make_child()
        make_event(child, "MEAL", hour=12)      # created first
        make_event(child, "BOTTLE", hour=8)     # happened earlier
        make_event(child, "MOOD", hour=16)
        api_client.force_authenticate(staff)

        response = api_client.get(timeline_url(child))

        types = [event["type"] for event in response.data["results"]]
        assert types == ["BOTTLE", "MEAL", "MOOD"]

    def test_creation_order_does_not_affect_display_order(
        self, api_client, staff, make_child, make_event
    ):
        child = make_child()
        later = make_event(child, "MOOD", hour=17)
        earlier = make_event(child, "BOTTLE", hour=7)
        api_client.force_authenticate(staff)

        response = api_client.get(timeline_url(child))
        ids = [event["id"] for event in response.data["results"]]

        assert ids == [str(earlier.id), str(later.id)]


@pytest.mark.django_db
class TestFiltering:
    @pytest.fixture
    def full_day(self, make_child, make_event):
        child = make_child()
        make_event(child, "BOTTLE", hour=8)
        make_event(child, "MEAL", hour=12)
        make_event(child, "SLEEP", hour=13)
        make_event(child, "TEMPERATURE", hour=14)
        make_event(child, "MOOD", hour=15)
        make_event(child, "DIAPER", hour=16)
        make_event(child, "TOILET", hour=17)
        return child

    @pytest.mark.parametrize(
        ("chip", "expected"),
        [
            ("meals", {"BOTTLE", "MEAL"}),
            ("sleep", {"SLEEP"}),
            ("health", {"TEMPERATURE", "MOOD"}),
            ("hygiene", {"DIAPER", "TOILET"}),
        ],
    )
    def test_filter_chips(self, api_client, staff, full_day, chip, expected):
        api_client.force_authenticate(staff)

        response = api_client.get(timeline_url(full_day), {"filter": chip})

        assert {e["type"] for e in response.data["results"]} == expected

    def test_all_returns_everything(self, api_client, staff, full_day):
        api_client.force_authenticate(staff)

        response = api_client.get(timeline_url(full_day), {"filter": "all"})

        assert response.data["count"] == 7

    def test_explicit_types_win_over_the_chip(
        self, api_client, staff, full_day
    ):
        api_client.force_authenticate(staff)

        response = api_client.get(
            timeline_url(full_day), {"types": "MOOD", "filter": "meals"}
        )

        assert {e["type"] for e in response.data["results"]} == {"MOOD"}

    def test_unknown_chip_returns_everything_rather_than_erroring(
        self, api_client, staff, full_day
    ):
        api_client.force_authenticate(staff)

        response = api_client.get(timeline_url(full_day), {"filter": "nope"})

        assert response.status_code == 200


@pytest.mark.django_db
class TestDateSelection:
    def test_defaults_to_today(self, api_client, staff, make_child, make_event):
        child = make_child()
        today_event = make_event(child, "BOTTLE", hour=9)
        yesterday = TimelineEvent.objects.create(
            child=child, type="MEAL",
            occurred_at=timezone.now() - timedelta(days=1),
            data={"meal": "LUNCH"}, is_published=True,
        )
        api_client.force_authenticate(staff)

        response = api_client.get(timeline_url(child))

        ids = [e["id"] for e in response.data["results"]]
        assert str(today_event.id) in ids
        assert str(yesterday.id) not in ids

    def test_specific_date(self, api_client, staff, make_child):
        child = make_child()
        target = timezone.localdate() - timedelta(days=3)
        event = TimelineEvent.objects.create(
            child=child, type="NOTE",
            occurred_at=timezone.now() - timedelta(days=3),
            is_published=True,
        )
        api_client.force_authenticate(staff)

        response = api_client.get(
            timeline_url(child), {"date": target.isoformat()}
        )

        assert [e["id"] for e in response.data["results"]] == [str(event.id)]

    def test_date_range(self, api_client, staff, make_child):
        child = make_child()
        for days_ago in (1, 2, 5):
            TimelineEvent.objects.create(
                child=child, type="NOTE",
                occurred_at=timezone.now() - timedelta(days=days_ago),
                is_published=True,
            )
        api_client.force_authenticate(staff)

        response = api_client.get(
            timeline_url(child),
            {
                "from": (timezone.localdate() - timedelta(days=3)).isoformat(),
                "to": timezone.localdate().isoformat(),
            },
        )

        assert response.data["count"] == 2

    def test_malformed_date_is_a_400(self, api_client, staff, make_child):
        api_client.force_authenticate(staff)

        response = api_client.get(timeline_url(make_child()), {"date": "hier"})

        assert response.status_code == 400


@pytest.mark.django_db
class TestEventCreation:
    def test_staff_records_an_event(self, api_client, staff, make_child):
        child = make_child()
        api_client.force_authenticate(staff)

        response = api_client.post(
            timeline_url(child),
            {
                "type": "BOTTLE",
                "occurred_at": timezone.now().isoformat(),
                "description": "Biberon du matin",
                "data": {"volume_ml": 180},
            },
        )

        assert response.status_code == 201
        assert response.data["data"]["volume_ml"] == 180
        assert response.data["icon"] == "milk"
        assert response.data["label"] == "Biberon"

    def test_child_and_author_come_from_the_server_not_the_body(
        self, api_client, staff, make_child, other_parent
    ):
        """Brief 17: child_id and created_by from the client are ignored."""
        child = make_child()
        decoy = make_child(first_name="Decoy")
        api_client.force_authenticate(staff)

        response = api_client.post(
            timeline_url(child),
            {
                "type": "NOTE",
                "occurred_at": timezone.now().isoformat(),
                "child": str(decoy.id),
                "created_by": str(other_parent.id),
            },
        )

        assert response.status_code == 201
        event = TimelineEvent.objects.get(pk=response.data["id"])
        assert event.child_id == child.id
        assert event.created_by_id == staff.id

    def test_invalid_payload_is_rejected(self, api_client, staff, make_child):
        api_client.force_authenticate(staff)

        response = api_client.post(
            timeline_url(make_child()),
            {
                "type": "BOTTLE",
                "occurred_at": timezone.now().isoformat(),
                "data": {"volume_ml": 9999},
            },
        )

        assert response.status_code == 400

    def test_unknown_key_in_payload_is_a_400_not_a_500(
        self, api_client, staff, make_child
    ):
        api_client.force_authenticate(staff)

        response = api_client.post(
            timeline_url(make_child()),
            {
                "type": "BOTTLE",
                "occurred_at": timezone.now().isoformat(),
                "data": {"volume_ml": 180, "typo_field": 1},
            },
        )

        assert response.status_code == 400

    def test_future_event_is_rejected(self, api_client, staff, make_child):
        api_client.force_authenticate(staff)

        response = api_client.post(
            timeline_url(make_child()),
            {
                "type": "NOTE",
                "occurred_at": (timezone.now() + timedelta(hours=2)).isoformat(),
            },
        )

        assert response.status_code == 400

    def test_reference_types_cannot_be_posted_directly(
        self, api_client, staff, make_child
    ):
        """ACTIVITY rows are created by the activities module."""
        api_client.force_authenticate(staff)

        response = api_client.post(
            timeline_url(make_child()),
            {"type": "ACTIVITY", "occurred_at": timezone.now().isoformat()},
        )

        assert response.status_code == 400

    def test_local_date_is_derived_not_supplied(
        self, api_client, staff, make_child
    ):
        child = make_child()
        api_client.force_authenticate(staff)

        response = api_client.post(
            timeline_url(child),
            {
                "type": "NOTE",
                "occurred_at": timezone.now().isoformat(),
                "local_date": "1999-01-01",
            },
        )

        event = TimelineEvent.objects.get(pk=response.data["id"])
        assert event.local_date == timezone.localdate()


@pytest.mark.django_db
class TestSleepIntervals:
    def test_sleep_starts_open_and_reports_in_progress(
        self, api_client, staff, make_child
    ):
        child = make_child()
        api_client.force_authenticate(staff)

        response = api_client.post(
            timeline_url(child),
            {"type": "SLEEP", "occurred_at": timezone.now().isoformat()},
        )

        assert response.data["ended_at"] is None
        assert response.data["is_open_interval"] is True
        assert response.data["duration_minutes"] is None

    def test_ending_a_sleep_computes_the_duration(
        self, api_client, staff, make_child, minutes_ago
    ):
        """The brief's own example: a 75-minute nap reads "Durée: 1h15".

        Anchored to `now` rather than to wall-clock 10:30, so the test does
        not depend on what time of day the suite runs.
        """
        from apps.care.models import TimelineEvent

        child = make_child()
        event = TimelineEvent.objects.create(
            child=child, type="SLEEP",
            occurred_at=minutes_ago(120), is_published=True,
        )
        api_client.force_authenticate(staff)

        response = api_client.post(
            reverse("timeline-event-end", args=[event.id]),
            {"ended_at": minutes_ago(45).isoformat()},
        )

        assert response.status_code == 200, response.data
        assert response.data["duration_minutes"] == 75
        assert response.data["is_open_interval"] is False

    def test_ending_defaults_to_now(
        self, api_client, staff, make_child, minutes_ago
    ):
        from apps.care.models import TimelineEvent

        event = TimelineEvent.objects.create(
            child=make_child(), type="SLEEP",
            occurred_at=minutes_ago(60), is_published=True,
        )
        api_client.force_authenticate(staff)

        response = api_client.post(reverse("timeline-event-end", args=[event.id]))

        assert response.status_code == 200, response.data
        assert response.data["ended_at"] is not None
        assert response.data["duration_minutes"] >= 59

    def test_ending_an_already_closed_interval_is_a_conflict(
        self, api_client, staff, make_child, make_event, at_today
    ):
        event = make_event(
            make_child(), "SLEEP", hour=10, ended_at=at_today(11, 0)
        )
        api_client.force_authenticate(staff)

        response = api_client.post(reverse("timeline-event-end", args=[event.id]))

        assert response.status_code == 409

    def test_ending_a_non_interval_type_is_a_conflict(
        self, api_client, staff, make_child, make_event
    ):
        event = make_event(make_child(), "BOTTLE", hour=8)
        api_client.force_authenticate(staff)

        response = api_client.post(reverse("timeline-event-end", args=[event.id]))

        assert response.status_code == 409

    def test_end_before_start_is_rejected(
        self, api_client, staff, make_child, make_event, at_today
    ):
        event = make_event(make_child(), "SLEEP", hour=14)
        api_client.force_authenticate(staff)

        response = api_client.post(
            reverse("timeline-event-end", args=[event.id]),
            {"ended_at": at_today(9, 0).isoformat()},
        )

        assert response.status_code == 400

    def test_ended_at_on_a_non_interval_type_is_rejected_at_create(
        self, api_client, staff, make_child
    ):
        api_client.force_authenticate(staff)
        now = timezone.now()

        response = api_client.post(
            timeline_url(make_child()),
            {
                "type": "BOTTLE",
                "occurred_at": now.isoformat(),
                "ended_at": (now + timedelta(minutes=10)).isoformat(),
                "data": {"volume_ml": 100},
            },
        )

        assert response.status_code == 400

    def test_parent_cannot_end_an_interval(
        self, api_client, parent, owned_child, make_event
    ):
        event = make_event(owned_child, "SLEEP", hour=10)
        api_client.force_authenticate(parent)

        response = api_client.post(reverse("timeline-event-end", args=[event.id]))

        assert response.status_code == 403


@pytest.mark.django_db
class TestPublicationVisibility:
    def test_parent_does_not_see_unpublished_events(
        self, api_client, parent, owned_child, make_event
    ):
        """Staff record all day; a parent should not watch a half-written
        day appear (docs/timeline.md 8)."""
        make_event(owned_child, "BOTTLE", hour=8, published=False)
        api_client.force_authenticate(parent)

        response = api_client.get(timeline_url(owned_child))

        assert response.data["count"] == 0

    def test_staff_see_unpublished_events(
        self, api_client, staff, make_child, make_event
    ):
        child = make_child()
        make_event(child, "BOTTLE", hour=8, published=False)
        api_client.force_authenticate(staff)

        response = api_client.get(timeline_url(child))

        assert response.data["count"] == 1

    def test_publishing_a_day_releases_its_events(
        self, api_client, staff, parent, owned_child, make_event
    ):
        make_event(owned_child, "BOTTLE", hour=8, published=False)
        make_event(owned_child, "MEAL", hour=12, published=False)

        api_client.force_authenticate(staff)
        api_client.post(reverse("child-daily-record-publish", args=[owned_child.id]))

        api_client.force_authenticate(parent)
        response = api_client.get(timeline_url(owned_child))

        assert response.data["count"] == 2

    def test_events_added_after_publication_stay_visible(
        self, api_client, staff, parent, owned_child
    ):
        """Otherwise a late entry would silently vanish from the parent's day."""
        api_client.force_authenticate(staff)
        api_client.post(reverse("child-daily-record-publish", args=[owned_child.id]))

        api_client.post(
            timeline_url(owned_child),
            {
                "type": "BOTTLE",
                "occurred_at": timezone.now().isoformat(),
                "data": {"volume_ml": 150},
            },
        )

        api_client.force_authenticate(parent)
        response = api_client.get(timeline_url(owned_child))

        assert response.data["count"] == 1

    def test_unpublishing_hides_the_day_again(
        self, api_client, staff, parent, owned_child, make_event
    ):
        make_event(owned_child, "BOTTLE", hour=8, published=False)
        api_client.force_authenticate(staff)
        api_client.post(reverse("child-daily-record-publish", args=[owned_child.id]))
        api_client.delete(reverse("child-daily-record-publish", args=[owned_child.id]))

        api_client.force_authenticate(parent)
        response = api_client.get(timeline_url(owned_child))

        assert response.data["count"] == 0


@pytest.mark.django_db
class TestQueryBudget:
    def test_timeline_query_count_is_constant(
        self, api_client, staff, make_child, make_event
    ):
        """The N+1 guarantee from docs/timeline.md 6.

        Ten events and forty events must cost the same number of queries;
        otherwise the timeline degrades as a child's day fills up.
        """
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        child = make_child()
        api_client.force_authenticate(staff)

        for hour in range(8, 18):
            make_event(child, "BOTTLE", hour=hour, created_by=staff)
        api_client.get(timeline_url(child))  # warm any lazy setup

        with CaptureQueriesContext(connection) as small:
            api_client.get(timeline_url(child))
        small_count = len(small.captured_queries)

        for hour in range(8, 18):
            for minute in (10, 20, 30):
                make_event(child, "MEAL", hour=hour, minute=minute, created_by=staff)

        with CaptureQueriesContext(connection) as large:
            response = api_client.get(timeline_url(child))
        large_count = len(large.captured_queries)

        assert response.data["count"] == 40
        assert small_count == large_count, (
            f"query count grew from {small_count} to {large_count} — N+1"
        )


@pytest.mark.django_db
class TestEveryQuickAddTypeRoundTrips:
    """Post each staff-recordable type through the real endpoint.

    Unit-testing the payload schemas is not enough: validated values must
    also survive being written to JSONB. A Decimal temperature passed
    validation but raised "Object of type Decimal is not JSON
    serializable" at save time, so this exercises the whole path.
    """

    PAYLOADS = {
        "BOTTLE": {"volume_ml": 180},
        "MEAL": {"meal": "LUNCH", "eaten": "ALL"},
        "SLEEP": {},
        "DIAPER": {"state": "WET"},
        "TOILET": {"success": True},
        "TEMPERATURE": {"celsius": "36.6"},
        "MOOD": {"mood": "HAPPY"},
        "NOTE": {},
    }

    @pytest.mark.parametrize("event_type", sorted(PAYLOADS))
    def test_type_round_trips_through_the_api(
        self, api_client, staff, make_child, event_type
    ):
        child = make_child()
        api_client.force_authenticate(staff)

        response = api_client.post(
            timeline_url(child),
            {
                "type": event_type,
                "occurred_at": timezone.now().isoformat(),
                "data": self.PAYLOADS[event_type],
            },
            format="json",
        )

        assert response.status_code == 201, response.data

        # And it can be read back without error.
        listed = api_client.get(timeline_url(child))
        assert listed.status_code == 200
        assert listed.data["count"] == 1

    def test_temperature_keeps_its_precision_as_a_string(
        self, api_client, staff, make_child
    ):
        """Stored as a string, not a float: 36.6 must not become 36.6000001."""
        child = make_child()
        api_client.force_authenticate(staff)

        response = api_client.post(
            timeline_url(child),
            {
                "type": "TEMPERATURE",
                "occurred_at": timezone.now().isoformat(),
                "data": {"celsius": "36.6"},
            },
            format="json",
        )

        assert response.data["data"]["celsius"] == "36.6"
        stored = TimelineEvent.objects.get(pk=response.data["id"])
        assert stored.data["celsius"] == "36.6"

    def test_temperature_feeds_the_daily_summary(
        self, api_client, staff, make_child
    ):
        child = make_child()
        api_client.force_authenticate(staff)
        api_client.post(
            timeline_url(child),
            {
                "type": "TEMPERATURE",
                "occurred_at": timezone.now().isoformat(),
                "data": {"celsius": "37.4"},
            },
            format="json",
        )

        record = api_client.get(reverse("child-daily-record", args=[child.id]))

        assert str(record.data["summary"]["health"]["last_temperature"]) == "37.4"
