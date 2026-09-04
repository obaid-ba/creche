"""Notification fan-out and API (brief 9; docs/api.md 11).

The property that matters: a notification reaches only entitled users.
Recipients are derived from guardianship or staff role, never supplied.
"""
import pytest
from django.urls import reverse

from apps.notifications.models import Notification, NotificationType

LIST_URL = reverse("notification-list")
UNREAD_URL = reverse("notification-unread-count")
READ_ALL_URL = reverse("notification-read-all")


def read_url(notification):
    return reverse("notification-read", args=[notification.id])


@pytest.mark.django_db
class TestOwnership:
    def test_you_only_see_your_own(self, api_client, parent, other_parent):
        Notification.objects.create(
            user=parent, type=NotificationType.NEW_MESSAGE, title="À moi"
        )
        Notification.objects.create(
            user=other_parent, type=NotificationType.NEW_MESSAGE, title="À eux"
        )
        api_client.force_authenticate(parent)

        response = api_client.get(LIST_URL)

        assert [n["title"] for n in response.data["results"]] == ["À moi"]

    def test_you_cannot_mark_someone_elses_as_read(
        self, api_client, parent, other_parent
    ):
        theirs = Notification.objects.create(
            user=other_parent, type=NotificationType.NEW_MESSAGE, title="À eux"
        )
        api_client.force_authenticate(parent)

        assert api_client.post(read_url(theirs)).status_code == 404

    def test_anonymous_is_rejected(self, api_client):
        assert api_client.get(LIST_URL).status_code == 401


@pytest.mark.django_db
class TestReadState:
    def test_unread_count(self, api_client, parent):
        Notification.objects.create(
            user=parent, type=NotificationType.NEW_MESSAGE, title="A"
        )
        Notification.objects.create(
            user=parent, type=NotificationType.NEW_MESSAGE, title="B"
        )
        api_client.force_authenticate(parent)

        assert api_client.get(UNREAD_URL).data["unread"] == 2

    def test_marking_one_read(self, api_client, parent):
        item = Notification.objects.create(
            user=parent, type=NotificationType.NEW_MESSAGE, title="A"
        )
        api_client.force_authenticate(parent)

        response = api_client.post(read_url(item))

        assert response.status_code == 200
        assert response.data["is_read"] is True
        assert api_client.get(UNREAD_URL).data["unread"] == 0

    def test_marking_read_twice_keeps_the_first_timestamp(
        self, api_client, parent
    ):
        item = Notification.objects.create(
            user=parent, type=NotificationType.NEW_MESSAGE, title="A"
        )
        api_client.force_authenticate(parent)
        first = api_client.post(read_url(item)).data["read_at"]

        second = api_client.post(read_url(item)).data["read_at"]

        assert first == second

    def test_read_all(self, api_client, parent):
        for i in range(3):
            Notification.objects.create(
                user=parent, type=NotificationType.NEW_MESSAGE, title=str(i)
            )
        api_client.force_authenticate(parent)

        assert api_client.post(READ_ALL_URL).status_code == 204
        assert api_client.get(UNREAD_URL).data["unread"] == 0

    def test_read_all_does_not_touch_other_users(
        self, api_client, parent, other_parent
    ):
        theirs = Notification.objects.create(
            user=other_parent, type=NotificationType.NEW_MESSAGE, title="À eux"
        )
        api_client.force_authenticate(parent)

        api_client.post(READ_ALL_URL)

        theirs.refresh_from_db()
        assert theirs.read_at is None

    def test_unread_filter(self, api_client, parent):
        read = Notification.objects.create(
            user=parent, type=NotificationType.NEW_MESSAGE, title="lu"
        )
        Notification.objects.create(
            user=parent, type=NotificationType.NEW_MESSAGE, title="non lu"
        )
        read.mark_read()
        api_client.force_authenticate(parent)

        response = api_client.get(LIST_URL, {"unread": "true"})

        assert [n["title"] for n in response.data["results"]] == ["non lu"]


@pytest.mark.django_db
class TestMessageFanOut:
    def test_staff_message_notifies_the_guardians(
        self, api_client, staff, parent, owned_child
    ):
        api_client.force_authenticate(staff)
        api_client.post(
            reverse("conversation-list"),
            {
                "child_id": str(owned_child.id),
                "body": "Bonjour, tout s'est bien passé.",
            },
        )

        assert Notification.objects.filter(
            user=parent, type=NotificationType.NEW_MESSAGE
        ).count() == 1

    def test_the_sender_is_not_notified(
        self, api_client, staff, owned_child
    ):
        api_client.force_authenticate(staff)
        api_client.post(
            reverse("conversation-list"),
            {"child_id": str(owned_child.id), "body": "Bonjour"},
        )

        assert Notification.objects.filter(user=staff).count() == 0

    def test_another_family_is_not_notified(
        self, api_client, staff, other_parent, owned_child
    ):
        api_client.force_authenticate(staff)
        api_client.post(
            reverse("conversation-list"),
            {"child_id": str(owned_child.id), "body": "Bonjour"},
        )

        assert Notification.objects.filter(user=other_parent).count() == 0

    def test_a_revoked_guardian_is_not_notified(
        self, api_client, staff, parent, owned_child, link_parent_to_child
    ):
        """Access is revoked, so the notifications stop too."""
        from apps.accounts.models import Guardianship

        Guardianship.objects.filter(child=owned_child).update(
            revoked_at="2026-01-01T00:00:00Z"
        )
        api_client.force_authenticate(staff)
        api_client.post(
            reverse("conversation-list"),
            {"child_id": str(owned_child.id), "body": "Bonjour"},
        )

        assert Notification.objects.filter(user=parent).count() == 0

    def test_parent_reply_notifies_staff(
        self, api_client, staff, parent, owned_child
    ):
        api_client.force_authenticate(staff)
        conversation_id = api_client.post(
            reverse("conversation-list"),
            {"child_id": str(owned_child.id), "body": "Bonjour"},
        ).data["id"]
        Notification.objects.all().delete()

        api_client.force_authenticate(parent)
        api_client.post(
            reverse("conversation-messages", args=[conversation_id]),
            {"body": "Merci !"},
        )

        assert Notification.objects.filter(user=staff).count() == 1


@pytest.mark.django_db
class TestDayPublishedFanOut:
    def test_publishing_notifies_the_guardians(
        self, api_client, staff, parent, owned_child
    ):
        api_client.force_authenticate(staff)

        api_client.post(
            reverse("child-daily-record-publish", args=[owned_child.id])
        )

        assert Notification.objects.filter(
            user=parent, type=NotificationType.DAY_PUBLISHED
        ).count() == 1

    def test_republishing_does_not_notify_again(
        self, api_client, staff, parent, owned_child
    ):
        """A correction should not ping the family a second time."""
        api_client.force_authenticate(staff)
        url = reverse("child-daily-record-publish", args=[owned_child.id])

        api_client.post(url)
        api_client.post(url)

        assert Notification.objects.filter(
            user=parent, type=NotificationType.DAY_PUBLISHED
        ).count() == 1


@pytest.mark.django_db
class TestComplaintFanOut:
    def test_filing_notifies_staff_not_the_filer(
        self, api_client, parent, staff
    ):
        api_client.force_authenticate(parent)

        api_client.post(
            reverse("complaint-list"), {"subject": "Horaires", "message": "…"}
        )

        assert Notification.objects.filter(
            user=staff, type=NotificationType.COMPLAINT_CREATED
        ).count() == 1
        assert Notification.objects.filter(user=parent).count() == 0

    def test_status_change_notifies_the_parent(
        self, api_client, parent, staff
    ):
        api_client.force_authenticate(parent)
        complaint_id = api_client.post(
            reverse("complaint-list"), {"subject": "Horaires", "message": "…"}
        ).data["id"]
        Notification.objects.all().delete()

        api_client.force_authenticate(staff)
        api_client.patch(
            reverse("complaint-change-status", args=[complaint_id]),
            {"status": "IN_PROGRESS"},
        )

        assert Notification.objects.filter(
            user=parent, type=NotificationType.COMPLAINT_UPDATED
        ).count() == 1

    def test_an_internal_note_notifies_nobody(
        self, api_client, parent, staff
    ):
        """The rule that matters: an internal note must not reach the family
        — not through the thread, and not through a notification."""
        api_client.force_authenticate(parent)
        complaint_id = api_client.post(
            reverse("complaint-list"), {"subject": "Horaires", "message": "…"}
        ).data["id"]
        Notification.objects.all().delete()

        api_client.force_authenticate(staff)
        api_client.post(
            reverse("complaint-replies", args=[complaint_id]),
            {"body": "Vérifier avec l'équipe du soir.", "is_internal": True},
        )

        assert Notification.objects.count() == 0

    def test_a_public_reply_notifies_the_parent(
        self, api_client, parent, staff
    ):
        api_client.force_authenticate(parent)
        complaint_id = api_client.post(
            reverse("complaint-list"), {"subject": "Horaires", "message": "…"}
        ).data["id"]
        Notification.objects.all().delete()

        api_client.force_authenticate(staff)
        api_client.post(
            reverse("complaint-replies", args=[complaint_id]),
            {"body": "Nous ajustons les horaires."},
        )

        assert Notification.objects.filter(
            user=parent, type=NotificationType.COMPLAINT_REPLY
        ).count() == 1


@pytest.mark.django_db
class TestActivityFanOut:
    def test_adding_a_child_notifies_their_guardians(
        self, api_client, staff, parent, owned_child
    ):
        from datetime import date

        from apps.activities.models import Activity

        activity = Activity.objects.create(
            title="Peinture", date=date.today(), created_by=staff
        )
        api_client.force_authenticate(staff)

        api_client.post(
            reverse("activity-participants", args=[activity.id]),
            {"child_ids": [str(owned_child.id)]},
        )

        assert Notification.objects.filter(
            user=parent, type=NotificationType.NEW_ACTIVITY
        ).count() == 1

    def test_other_families_are_not_notified(
        self, api_client, staff, other_parent, owned_child
    ):
        from datetime import date

        from apps.activities.models import Activity

        activity = Activity.objects.create(
            title="Peinture", date=date.today(), created_by=staff
        )
        api_client.force_authenticate(staff)

        api_client.post(
            reverse("activity-participants", args=[activity.id]),
            {"child_ids": [str(owned_child.id)]},
        )

        assert Notification.objects.filter(user=other_parent).count() == 0
