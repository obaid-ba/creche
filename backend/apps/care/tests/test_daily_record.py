"""Daily record and computed summary (docs/timeline.md 3.1)."""
from decimal import Decimal

import pytest
from django.urls import reverse

from apps.care.models import DailyRecord, DailyRecordStatus
from apps.care.summary import build_summary, format_duration


def record_url(child):
    return reverse("child-daily-record", args=[child.id])


def publish_url(child):
    return reverse("child-daily-record-publish", args=[child.id])


class TestFormatDuration:
    @pytest.mark.parametrize(
        ("minutes", "expected"),
        [
            (0, "0 min"),
            (-5, "0 min"),
            (1, "1 min"),
            (45, "45 min"),
            (60, "1h"),
            (75, "1h15"),
            (125, "2h05"),
            (600, "10h"),
        ],
    )
    def test_french_duration(self, minutes, expected):
        assert format_duration(minutes) == expected


@pytest.mark.django_db
class TestSummaryAggregation:
    def test_empty_day(self, make_child):
        summary = build_summary([])

        assert summary["feeding"]["meals"] == 0
        assert summary["sleep"]["naps"] == 0
        assert summary["event_count"] == 0

    def test_counts_feeding(self, make_child, make_event):
        child = make_child()
        events = [
            make_event(child, "BOTTLE", hour=8, data={"volume_ml": 180}),
            make_event(child, "BOTTLE", hour=16, data={"volume_ml": 150}),
            make_event(child, "MEAL", hour=12, data={"meal": "LUNCH", "eaten": "ALL"}),
        ]

        summary = build_summary(events)

        assert summary["feeding"]["bottles"] == 2
        assert summary["feeding"]["total_ml"] == 330
        assert summary["feeding"]["meals"] == 1
        assert summary["feeding"]["details"][0]["label"] == "Déjeuner"

    def test_sums_sleep_and_ignores_an_open_nap(
        self, make_child, make_event, at_today
    ):
        """An open nap must not make the total creep upward on every read."""
        child = make_child()
        events = [
            make_event(child, "SLEEP", hour=10, minute=30,
                       ended_at=at_today(11, 45)),
            make_event(child, "SLEEP", hour=14, ended_at=None),
        ]

        summary = build_summary(events)

        assert summary["sleep"]["naps"] == 2
        assert summary["sleep"]["total_minutes"] == 75
        assert summary["sleep"]["total_display"] == "1h15"
        assert summary["sleep"]["in_progress"] is True

    def test_takes_the_latest_temperature(self, make_child, make_event):
        child = make_child()
        events = [
            make_event(child, "TEMPERATURE", hour=9, data={"celsius": "37.2"}),
            make_event(child, "TEMPERATURE", hour=14, data={"celsius": "36.6"}),
        ]

        summary = build_summary(events)

        assert summary["health"]["temperature_count"] == 2
        assert summary["health"]["last_temperature"] == Decimal("36.6")

    def test_takes_the_latest_mood_with_a_french_label(
        self, make_child, make_event
    ):
        child = make_child()
        events = [
            make_event(child, "MOOD", hour=9, data={"mood": "TIRED"}),
            make_event(child, "MOOD", hour=15, data={"mood": "HAPPY"}),
        ]

        summary = build_summary(events)

        assert summary["mood"]["latest"] == "HAPPY"
        assert summary["mood"]["latest_label"] == "Joyeux"
        assert summary["mood"]["observations"] == 2

    def test_counts_hygiene(self, make_child, make_event):
        child = make_child()
        events = [
            make_event(child, "DIAPER", hour=9),
            make_event(child, "DIAPER", hour=13),
            make_event(child, "TOILET", hour=15, data={"success": True}),
            make_event(child, "TOILET", hour=16, data={"success": False}),
        ]

        summary = build_summary(events)

        assert summary["hygiene"]["diaper_changes"] == 2
        assert summary["hygiene"]["toilet_visits"] == 2
        assert summary["hygiene"]["toilet_successes"] == 1

    def test_malformed_volume_does_not_crash_the_summary(
        self, make_child, make_event
    ):
        """Legacy or hand-edited rows must not break a parent's screen."""
        child = make_child()
        events = [make_event(child, "BOTTLE", hour=8, data={"volume_ml": "oops"})]

        summary = build_summary(events)

        assert summary["feeding"]["bottles"] == 1
        assert summary["feeding"]["total_ml"] == 0


@pytest.mark.django_db
class TestDailyRecordEndpoint:
    def test_empty_day_returns_a_record_shape_not_a_404(
        self, api_client, staff, make_child
    ):
        """A day with nothing logged is still a legitimate day."""
        api_client.force_authenticate(staff)

        response = api_client.get(record_url(make_child()))

        assert response.status_code == 200
        assert response.data["id"] is None
        assert response.data["summary"]["event_count"] == 0

    def test_summary_matches_the_underlying_events(
        self, api_client, staff, make_child, make_event, at_today
    ):
        """The property that makes DailyRecord a read model: it is derived
        from the same rows the timeline renders, so the two cannot
        disagree."""
        child = make_child()
        make_event(child, "BOTTLE", hour=8, data={"volume_ml": 180})
        make_event(child, "BOTTLE", hour=16, data={"volume_ml": 150})
        make_event(child, "SLEEP", hour=10, minute=30, ended_at=at_today(11, 45))
        make_event(child, "TEMPERATURE", hour=14, data={"celsius": "36.6"})
        api_client.force_authenticate(staff)

        response = api_client.get(record_url(child))
        summary = response.data["summary"]

        assert summary["feeding"]["bottles"] == 2
        assert summary["feeding"]["total_ml"] == 330
        assert summary["sleep"]["total_display"] == "1h15"
        assert str(summary["health"]["last_temperature"]) == "36.6"

    def test_staff_can_save_general_notes(self, api_client, staff, make_child):
        child = make_child()
        api_client.force_authenticate(staff)

        response = api_client.put(
            record_url(child), {"general_notes": "Très bonne journée."}
        )

        assert response.status_code == 200
        assert DailyRecord.objects.get(child=child).general_notes == (
            "Très bonne journée."
        )

    def test_saving_twice_updates_rather_than_duplicating(
        self, api_client, staff, make_child
    ):
        """UNIQUE(child, date) - one record per child per day."""
        child = make_child()
        api_client.force_authenticate(staff)

        api_client.put(record_url(child), {"general_notes": "Première note."})
        api_client.put(record_url(child), {"general_notes": "Note corrigée."})

        assert DailyRecord.objects.filter(child=child).count() == 1
        assert DailyRecord.objects.get(child=child).general_notes == "Note corrigée."

    def test_parent_cannot_write_notes(self, api_client, parent, owned_child):
        api_client.force_authenticate(parent)

        response = api_client.put(
            record_url(owned_child), {"general_notes": "Tentative."}
        )

        assert response.status_code == 403

    def test_parent_cannot_read_another_childs_record(
        self, api_client, parent, other_parent, make_child, link_parent_to_child
    ):
        theirs = make_child()
        link_parent_to_child(other_parent, theirs)
        api_client.force_authenticate(parent)

        assert api_client.get(record_url(theirs)).status_code == 404

    def test_parents_summary_counts_only_published_events(
        self, api_client, parent, owned_child, make_event
    ):
        """The summary must agree with what the parent can actually see."""
        make_event(owned_child, "BOTTLE", hour=8, published=True,
                   data={"volume_ml": 180})
        make_event(owned_child, "BOTTLE", hour=16, published=False,
                   data={"volume_ml": 150})
        api_client.force_authenticate(parent)

        response = api_client.get(record_url(owned_child))

        assert response.data["summary"]["feeding"]["bottles"] == 1
        assert response.data["summary"]["feeding"]["total_ml"] == 180


@pytest.mark.django_db
class TestPublication:
    def test_publishing_sets_the_status(self, api_client, staff, make_child):
        child = make_child()
        api_client.force_authenticate(staff)

        response = api_client.post(publish_url(child))

        assert response.status_code == 200
        assert response.data["status"] == DailyRecordStatus.PUBLISHED
        assert response.data["published_at"] is not None

    def test_publishing_creates_the_record_if_absent(
        self, api_client, staff, make_child
    ):
        child = make_child()
        api_client.force_authenticate(staff)

        api_client.post(publish_url(child))

        assert DailyRecord.objects.filter(child=child).exists()

    def test_parent_cannot_publish(self, api_client, parent, owned_child):
        api_client.force_authenticate(parent)

        assert api_client.post(publish_url(owned_child)).status_code == 403

    def test_unpublishing_a_missing_record_is_a_404(
        self, api_client, staff, make_child
    ):
        api_client.force_authenticate(staff)

        assert api_client.delete(publish_url(make_child())).status_code == 404


@pytest.mark.django_db
class TestEventTypesEndpoint:
    def test_returns_the_registry(self, api_client, staff):
        api_client.force_authenticate(staff)

        response = api_client.get(reverse("event-types"))

        assert response.status_code == 200
        keys = {t["key"] for t in response.data["types"]}
        assert {"BOTTLE", "MEAL", "SLEEP", "TEMPERATURE"} <= keys

    def test_returns_filter_groups_with_french_labels(self, api_client, staff):
        api_client.force_authenticate(staff)

        response = api_client.get(reverse("event-types"))

        groups = {f["key"]: f["label"] for f in response.data["filters"]}
        assert groups["meals"] == "Repas"
        assert groups["hygiene"] == "Hygiène"

    def test_requires_authentication(self, api_client):
        assert api_client.get(reverse("event-types")).status_code == 401
