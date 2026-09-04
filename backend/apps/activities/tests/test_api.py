"""Activity API tests (brief 12, docs/timeline.md 3)."""
from datetime import date, time, timedelta

import pytest
from django.urls import reverse

from apps.activities.models import Activity, ActivityParticipation
from apps.care.models import TimelineEvent

LIST_URL = reverse("activity-list")


def detail_url(activity):
    return reverse("activity-detail", args=[activity.id])


def participants_url(activity):
    return reverse("activity-participants", args=[activity.id])


@pytest.fixture
def activity(db, staff):
    return Activity.objects.create(
        title="Peinture",
        description="Atelier peinture aux doigts",
        date=date.today(),
        start_time=time(9, 0),
        end_time=time(10, 0),
        category="ART",
        created_by=staff,
    )


@pytest.mark.django_db
class TestPermissions:
    def test_parent_cannot_create(self, api_client, parent):
        api_client.force_authenticate(parent)

        response = api_client.post(
            LIST_URL, {"title": "X", "date": date.today().isoformat()}
        )

        assert response.status_code == 403

    def test_parent_cannot_add_participants(
        self, api_client, parent, activity, owned_child
    ):
        api_client.force_authenticate(parent)

        response = api_client.post(
            participants_url(activity), {"child_ids": [str(owned_child.id)]}
        )

        assert response.status_code == 403

    def test_parent_cannot_upload_photos(self, api_client, parent, activity):
        api_client.force_authenticate(parent)

        response = api_client.post(
            reverse("activity-photos", args=[activity.id]), {}, format="multipart"
        )

        assert response.status_code == 403

    def test_staff_can_create(self, api_client, staff):
        api_client.force_authenticate(staff)

        response = api_client.post(
            LIST_URL,
            {
                "title": "Musique",
                "date": date.today().isoformat(),
                "category": "MUSIC",
            },
        )

        assert response.status_code == 201
        assert Activity.objects.count() == 1

    def test_anonymous_is_rejected(self, api_client):
        assert api_client.get(LIST_URL).status_code == 401


@pytest.mark.django_db
class TestParentVisibility:
    def test_parent_sees_only_activities_their_child_joined(
        self, api_client, parent, other_parent, owned_child, make_child,
        link_parent_to_child, staff, activity,
    ):
        theirs = make_child(first_name="Yasmine")
        link_parent_to_child(other_parent, theirs)

        other_activity = Activity.objects.create(
            title="Musique", date=date.today(), created_by=staff
        )
        ActivityParticipation.objects.create(activity=activity, child=owned_child)
        ActivityParticipation.objects.create(activity=other_activity, child=theirs)

        api_client.force_authenticate(parent)
        response = api_client.get(LIST_URL)

        titles = [row["title"] for row in response.data["results"]]
        assert titles == ["Peinture"]

    def test_parent_does_not_see_other_childrens_names(
        self, api_client, parent, owned_child, make_child, activity
    ):
        """Otherwise the roster of the whole nursery leaks to every family."""
        classmate = make_child(first_name="Yasmine")
        ActivityParticipation.objects.create(activity=activity, child=owned_child)
        ActivityParticipation.objects.create(activity=activity, child=classmate)

        api_client.force_authenticate(parent)
        response = api_client.get(detail_url(activity))

        assert "participants" not in response.data
        # A count is fine; names are not.
        assert response.data["participant_count"] == 2

    def test_staff_do_see_participant_names(
        self, api_client, staff, activity, make_child
    ):
        ActivityParticipation.objects.create(
            activity=activity, child=make_child(first_name="Mohamed")
        )
        api_client.force_authenticate(staff)

        response = api_client.get(detail_url(activity))

        assert response.data["participants"][0]["first_name"] == "Mohamed"

    def test_parent_cannot_open_an_activity_their_child_missed(
        self, api_client, parent, activity, make_child
    ):
        ActivityParticipation.objects.create(
            activity=activity, child=make_child(first_name="Autre")
        )
        api_client.force_authenticate(parent)

        assert api_client.get(detail_url(activity)).status_code == 404


@pytest.mark.django_db
class TestTimelineProjection:
    def test_adding_participants_creates_one_event_per_child(
        self, api_client, staff, activity, make_child
    ):
        children = [make_child(first_name=f"Enfant{i}") for i in range(3)]
        api_client.force_authenticate(staff)

        response = api_client.post(
            participants_url(activity),
            {"child_ids": [str(child.id) for child in children]},
        )

        assert response.status_code == 201
        events = TimelineEvent.objects.filter(activity=activity)
        assert events.count() == 3
        assert {e.child_id for e in events} == {c.id for c in children}
        assert all(e.type == "ACTIVITY" for e in events)

    def test_the_event_references_rather_than_copies_the_title(
        self, api_client, staff, activity, make_child
    ):
        """docs/timeline.md 3: reference rows hold the FK, not the content."""
        child = make_child()
        api_client.force_authenticate(staff)
        api_client.post(participants_url(activity), {"child_ids": [str(child.id)]})

        event = TimelineEvent.objects.get(activity=activity)
        assert event.title == ""
        assert event.description == ""
        assert event.activity_id == activity.id

    def test_renaming_the_activity_updates_every_timeline(
        self, api_client, staff, activity, make_child, parent, link_parent_to_child
    ):
        """The staleness bug a copy would have caused."""
        child = make_child()
        link_parent_to_child(parent, child)
        api_client.force_authenticate(staff)
        api_client.post(participants_url(activity), {"child_ids": [str(child.id)]})

        api_client.patch(detail_url(activity), {"title": "Peinture aux doigts"})

        timeline = api_client.get(reverse("child-timeline", args=[child.id]))
        activity_event = next(
            e for e in timeline.data["results"] if e["type"] == "ACTIVITY"
        )
        assert activity_event["activity"]["title"] == "Peinture aux doigts"

    def test_adding_the_same_child_twice_is_idempotent(
        self, api_client, staff, activity, make_child
    ):
        child = make_child()
        api_client.force_authenticate(staff)

        api_client.post(participants_url(activity), {"child_ids": [str(child.id)]})
        api_client.post(participants_url(activity), {"child_ids": [str(child.id)]})

        assert TimelineEvent.objects.filter(activity=activity).count() == 1
        assert ActivityParticipation.objects.filter(activity=activity).count() == 1

    def test_removing_a_participant_removes_their_event(
        self, api_client, staff, activity, make_child
    ):
        child = make_child()
        api_client.force_authenticate(staff)
        api_client.post(participants_url(activity), {"child_ids": [str(child.id)]})

        response = api_client.delete(
            reverse("activity-remove-participant", args=[activity.id, child.id])
        )

        assert response.status_code == 204
        assert TimelineEvent.objects.filter(activity=activity).count() == 0

    def test_deleting_the_activity_removes_its_events(
        self, api_client, staff, activity, make_child
    ):
        child = make_child()
        api_client.force_authenticate(staff)
        api_client.post(participants_url(activity), {"child_ids": [str(child.id)]})

        api_client.delete(detail_url(activity))

        assert TimelineEvent.objects.filter(type="ACTIVITY").count() == 0

    def test_moving_the_activity_moves_its_events(
        self, api_client, staff, activity, make_child
    ):
        child = make_child()
        api_client.force_authenticate(staff)
        api_client.post(participants_url(activity), {"child_ids": [str(child.id)]})

        # Both times move together: shifting only the start would leave
        # end_time earlier than start_time, which validation rejects.
        response = api_client.patch(
            detail_url(activity),
            {"start_time": "14:30:00", "end_time": "15:30:00"},
        )
        assert response.status_code == 200, response.data

        event = TimelineEvent.objects.get(activity=activity)
        from django.utils import timezone

        assert timezone.localtime(event.occurred_at).strftime("%H:%M") == "14:30"

    def test_an_unowned_child_id_is_ignored(
        self, api_client, staff, activity
    ):
        """Ids are resolved through the caller's queryset, never trusted."""
        import uuid as uuid_module

        api_client.force_authenticate(staff)

        response = api_client.post(
            participants_url(activity), {"child_ids": [str(uuid_module.uuid4())]}
        )

        assert response.status_code == 400
        assert TimelineEvent.objects.count() == 0

    def test_activity_appears_in_the_childs_timeline(
        self, api_client, staff, activity, make_child
    ):
        child = make_child()
        api_client.force_authenticate(staff)
        api_client.post(participants_url(activity), {"child_ids": [str(child.id)]})

        timeline = api_client.get(reverse("child-timeline", args=[child.id]))

        activity_events = [
            e for e in timeline.data["results"] if e["type"] == "ACTIVITY"
        ]
        assert len(activity_events) == 1
        assert activity_events[0]["activity"]["title"] == "Peinture"
        assert activity_events[0]["icon"] == "palette"


@pytest.mark.django_db
class TestValidation:
    def test_end_before_start_is_rejected(self, api_client, staff):
        api_client.force_authenticate(staff)

        response = api_client.post(
            LIST_URL,
            {
                "title": "X",
                "date": date.today().isoformat(),
                "start_time": "14:00:00",
                "end_time": "09:00:00",
            },
        )

        assert response.status_code == 400

    def test_future_date_is_rejected(self, api_client, staff):
        api_client.force_authenticate(staff)

        response = api_client.post(
            LIST_URL,
            {
                "title": "X",
                "date": (date.today() + timedelta(days=1)).isoformat(),
            },
        )

        assert response.status_code == 400

    def test_empty_participant_list_is_rejected(self, api_client, staff, activity):
        api_client.force_authenticate(staff)

        response = api_client.post(participants_url(activity), {"child_ids": []})

        assert response.status_code == 400


@pytest.mark.django_db
class TestFiltering:
    def test_filter_by_date(self, api_client, staff, activity):
        Activity.objects.create(
            title="Ancienne", date=date.today() - timedelta(days=5), created_by=staff
        )
        api_client.force_authenticate(staff)

        response = api_client.get(LIST_URL, {"date": date.today().isoformat()})

        assert [r["title"] for r in response.data["results"]] == ["Peinture"]

    def test_filter_by_category(self, api_client, staff, activity):
        Activity.objects.create(
            title="Musique", date=date.today(), category="MUSIC", created_by=staff
        )
        api_client.force_authenticate(staff)

        response = api_client.get(LIST_URL, {"category": "MUSIC"})

        assert [r["title"] for r in response.data["results"]] == ["Musique"]

    def test_staff_can_filter_by_child(
        self, api_client, staff, activity, make_child
    ):
        child = make_child()
        ActivityParticipation.objects.create(activity=activity, child=child)
        Activity.objects.create(title="Sans enfant", date=date.today(), created_by=staff)
        api_client.force_authenticate(staff)

        response = api_client.get(LIST_URL, {"child": str(child.id)})

        assert [r["title"] for r in response.data["results"]] == ["Peinture"]

    def test_french_category_label_is_returned(self, api_client, staff, activity):
        api_client.force_authenticate(staff)

        response = api_client.get(detail_url(activity))

        assert response.data["category_label"] == "Arts plastiques"


@pytest.mark.django_db
class TestPartialUpdateGuards:
    def test_moving_the_start_past_the_end_is_rejected(
        self, api_client, staff, activity
    ):
        """A PATCH is validated against the stored values it does not send."""
        api_client.force_authenticate(staff)

        response = api_client.patch(
            detail_url(activity), {"start_time": "14:30:00"}
        )

        assert response.status_code == 400
        assert "end_time" in response.data["error"]["details"]
