"""Dashboard tests (brief 15-16).

A dashboard aggregates data from every module, so it is exactly the kind
of endpoint that can quietly leak what the list endpoints refuse. These
tests check the scoping as much as the arithmetic.
"""
from datetime import date

import pytest
from dateutil.relativedelta import relativedelta
from django.urls import reverse

PARENT_URL = reverse("dashboard-parent")
STAFF_URL = reverse("dashboard-staff")


@pytest.mark.django_db
class TestParentDashboard:
    def test_lists_only_their_own_children(
        self, api_client, parent, other_parent, owned_child, make_child,
        link_parent_to_child,
    ):
        link_parent_to_child(other_parent, make_child(first_name="Yasmine"))
        api_client.force_authenticate(parent)

        response = api_client.get(PARENT_URL)

        assert [c["first_name"] for c in response.data["children"]] == ["Mohamed"]

    def test_includes_computed_age_and_group(
        self, api_client, parent, make_child, link_parent_to_child
    ):
        child = make_child(
            first_name="Bebe", date_of_birth=date.today() - relativedelta(months=3)
        )
        link_parent_to_child(parent, child)
        api_client.force_authenticate(parent)

        row = api_client.get(PARENT_URL).data["children"][0]

        assert row["age_display"] == "3 mois"
        assert row["age_group"]["key"] == "INFANT"

    def test_summary_excludes_unpublished_events(
        self, api_client, parent, owned_child, make_event
    ):
        """The dashboard must agree with what the parent can actually see."""
        make_event(owned_child, "BOTTLE", hour=8, published=True,
                   data={"volume_ml": 180})
        make_event(owned_child, "BOTTLE", hour=16, published=False,
                   data={"volume_ml": 150})
        api_client.force_authenticate(parent)

        row = api_client.get(PARENT_URL).data["children"][0]

        assert row["summary"]["feeding"]["bottles"] == 1
        assert row["summary"]["feeding"]["total_ml"] == 180

    def test_reports_whether_the_day_is_published(
        self, api_client, parent, staff, owned_child
    ):
        api_client.force_authenticate(parent)
        assert api_client.get(PARENT_URL).data["children"][0]["day_published"] is False

        api_client.force_authenticate(staff)
        api_client.post(reverse("child-daily-record-publish", args=[owned_child.id]))

        api_client.force_authenticate(parent)
        assert api_client.get(PARENT_URL).data["children"][0]["day_published"] is True

    def test_counts_open_complaints_only(self, api_client, parent):
        api_client.force_authenticate(parent)
        for subject in ("A", "B"):
            api_client.post(
                reverse("complaint-list"), {"subject": subject, "message": "…"}
            )

        assert api_client.get(PARENT_URL).data["open_complaints"] == 2

    def test_resolved_complaints_are_not_counted_as_open(
        self, api_client, parent, staff
    ):
        api_client.force_authenticate(parent)
        complaint_id = api_client.post(
            reverse("complaint-list"), {"subject": "A", "message": "…"}
        ).data["id"]

        api_client.force_authenticate(staff)
        url = reverse("complaint-change-status", args=[complaint_id])
        api_client.patch(url, {"status": "IN_PROGRESS"})
        api_client.patch(url, {"status": "RESOLVED"})

        api_client.force_authenticate(parent)
        assert api_client.get(PARENT_URL).data["open_complaints"] == 0

    def test_a_parent_with_no_children_gets_an_empty_dashboard(
        self, api_client, parent
    ):
        api_client.force_authenticate(parent)

        response = api_client.get(PARENT_URL)

        assert response.status_code == 200
        assert response.data["children"] == []

    def test_requires_authentication(self, api_client):
        assert api_client.get(PARENT_URL).status_code == 401


@pytest.mark.django_db
class TestStaffDashboard:
    def test_parents_are_refused(self, api_client, parent):
        api_client.force_authenticate(parent)

        assert api_client.get(STAFF_URL).status_code == 403

    def test_counts_children_by_age_band(self, api_client, staff, make_child):
        today = date.today()
        make_child(date_of_birth=today - relativedelta(months=3))
        make_child(date_of_birth=today - relativedelta(months=9))
        make_child(date_of_birth=today - relativedelta(months=30))
        api_client.force_authenticate(staff)

        response = api_client.get(STAFF_URL)

        counts = {g["key"]: g["count"] for g in response.data["age_groups"]}
        assert counts == {"INFANT": 1, "BABY": 1, "TODDLER": 0, "PRESCHOOL": 1}
        assert response.data["total_children"] == 3

    def test_bands_are_labelled_in_french(self, api_client, staff):
        api_client.force_authenticate(staff)

        labels = {
            g["key"]: g["label"]
            for g in api_client.get(STAFF_URL).data["age_groups"]
        }
        assert labels["TODDLER"] == "1 → 2 ans"

    def test_archived_children_are_excluded(
        self, api_client, staff, make_child, admin
    ):
        child = make_child()
        child.archive(by=admin)
        api_client.force_authenticate(staff)

        assert api_client.get(STAFF_URL).data["total_children"] == 0

    def test_counts_new_complaints(self, api_client, staff, parent):
        api_client.force_authenticate(parent)
        api_client.post(reverse("complaint-list"), {"subject": "A", "message": "…"})
        api_client.force_authenticate(staff)

        assert api_client.get(STAFF_URL).data["new_complaints"] == 1

    def test_lists_recent_activities_with_counts(
        self, api_client, staff, make_child
    ):
        from apps.activities.models import Activity

        activity = Activity.objects.create(
            title="Peinture", date=date.today(), created_by=staff
        )
        api_client.force_authenticate(staff)
        api_client.post(
            reverse("activity-participants", args=[activity.id]),
            {"child_ids": [str(make_child().id)]},
        )

        response = api_client.get(STAFF_URL)

        assert response.data["recent_activities"][0]["title"] == "Peinture"
        assert response.data["recent_activities"][0]["participant_count"] == 1

    def test_reports_todays_recording_progress(
        self, api_client, staff, make_child, make_event
    ):
        """Stands in for the attendance placeholder in the brief: what is
        real today is how much of the day has actually been recorded."""
        child = make_child()
        make_event(child, "BOTTLE", hour=9)
        api_client.force_authenticate(staff)

        response = api_client.get(STAFF_URL)

        assert response.data["children_with_events_today"] == 1
        assert response.data["days_published_today"] == 0
