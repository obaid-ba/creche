"""Messaging tests (brief 13, 27; docs/api.md 9)."""
import pytest
from django.urls import reverse

from apps.messaging.models import Conversation, Message, MessageRead

LIST_URL = reverse("conversation-list")
UNREAD_URL = reverse("unread-count")


def messages_url(conversation):
    return reverse("conversation-messages", args=[conversation.id])


def read_url(conversation):
    return reverse("conversation-read", args=[conversation.id])


@pytest.fixture
def conversation(db, owned_child, staff):
    convo = Conversation.objects.create(child=owned_child, subject="Journée")
    Message.objects.create(
        conversation=convo, sender=staff, body="Bonjour, tout s'est bien passé."
    )
    return convo


@pytest.mark.django_db
class TestParticipantScoping:
    def test_parent_sees_their_own_childs_conversation(
        self, api_client, parent, conversation
    ):
        api_client.force_authenticate(parent)

        response = api_client.get(LIST_URL)

        assert response.data["count"] == 1

    def test_parent_cannot_see_another_familys_conversation(
        self, api_client, other_parent, conversation
    ):
        api_client.force_authenticate(other_parent)

        assert api_client.get(LIST_URL).data["count"] == 0

    def test_non_participant_gets_404_on_the_detail(
        self, api_client, other_parent, conversation
    ):
        api_client.force_authenticate(other_parent)

        response = api_client.get(
            reverse("conversation-detail", args=[conversation.id])
        )

        assert response.status_code == 404

    def test_non_participant_cannot_read_the_messages(
        self, api_client, other_parent, conversation
    ):
        api_client.force_authenticate(other_parent)

        assert api_client.get(messages_url(conversation)).status_code == 404

    def test_non_participant_cannot_post(
        self, api_client, other_parent, conversation
    ):
        api_client.force_authenticate(other_parent)

        response = api_client.post(messages_url(conversation), {"body": "Coucou"})

        assert response.status_code == 404
        assert Message.objects.count() == 1

    def test_staff_can_see_every_conversation(
        self, api_client, staff, conversation
    ):
        api_client.force_authenticate(staff)

        assert api_client.get(LIST_URL).data["count"] == 1

    def test_anonymous_is_rejected(self, api_client):
        assert api_client.get(LIST_URL).status_code == 401


@pytest.mark.django_db
class TestSending:
    def test_staff_can_start_a_conversation(
        self, api_client, staff, owned_child
    ):
        api_client.force_authenticate(staff)

        response = api_client.post(
            LIST_URL,
            {
                "child_id": str(owned_child.id),
                "subject": "Peinture",
                "body": "Mohamed a participé à une activité de peinture.",
            },
        )

        assert response.status_code == 201
        assert Conversation.objects.count() == 1
        assert Message.objects.count() == 1

    def test_parent_can_reply_when_allowed(
        self, api_client, parent, conversation
    ):
        api_client.force_authenticate(parent)

        response = api_client.post(messages_url(conversation), {"body": "Merci !"})

        assert response.status_code == 201

    def test_parent_is_blocked_when_messaging_is_disabled(
        self, api_client, parent, conversation
    ):
        """brief 13: a parent may send "if allowed"."""
        profile = parent.parent_profile
        profile.can_send_messages = False
        profile.save(update_fields=["can_send_messages"])
        api_client.force_authenticate(parent)

        response = api_client.post(messages_url(conversation), {"body": "Bonjour"})

        assert response.status_code == 403
        assert Message.objects.count() == 1

    def test_a_blocked_parent_can_still_read(
        self, api_client, parent, conversation
    ):
        profile = parent.parent_profile
        profile.can_send_messages = False
        profile.save(update_fields=["can_send_messages"])
        api_client.force_authenticate(parent)

        assert api_client.get(messages_url(conversation)).status_code == 200

    def test_staff_are_never_blocked_by_the_parent_setting(
        self, api_client, staff, parent, conversation
    ):
        profile = parent.parent_profile
        profile.can_send_messages = False
        profile.save(update_fields=["can_send_messages"])
        api_client.force_authenticate(staff)

        response = api_client.post(messages_url(conversation), {"body": "Bonjour"})

        assert response.status_code == 201

    def test_empty_message_is_rejected(self, api_client, staff, conversation):
        api_client.force_authenticate(staff)

        response = api_client.post(messages_url(conversation), {"body": "   "})

        assert response.status_code == 400

    def test_cannot_start_a_conversation_about_another_familys_child(
        self, api_client, other_parent, owned_child
    ):
        api_client.force_authenticate(other_parent)

        response = api_client.post(
            LIST_URL, {"child_id": str(owned_child.id), "body": "Bonjour"}
        )

        assert response.status_code == 404
        assert Conversation.objects.count() == 0

    def test_sending_updates_the_conversation_timestamp(
        self, api_client, staff, conversation
    ):
        before = conversation.last_message_at
        api_client.force_authenticate(staff)

        api_client.post(messages_url(conversation), {"body": "Suite"})

        conversation.refresh_from_db()
        assert conversation.last_message_at != before


@pytest.mark.django_db
class TestReadReceipts:
    def test_a_new_message_is_unread_for_the_recipient(
        self, api_client, parent, conversation
    ):
        api_client.force_authenticate(parent)

        assert api_client.get(UNREAD_URL).data["unread"] == 1

    def test_your_own_message_is_never_unread_for_you(
        self, api_client, staff, conversation
    ):
        api_client.force_authenticate(staff)

        assert api_client.get(UNREAD_URL).data["unread"] == 0

    def test_marking_read_clears_the_count(
        self, api_client, parent, conversation
    ):
        api_client.force_authenticate(parent)

        response = api_client.post(read_url(conversation))

        assert response.status_code == 204
        assert api_client.get(UNREAD_URL).data["unread"] == 0

    def test_marking_read_twice_does_not_duplicate_receipts(
        self, api_client, parent, conversation
    ):
        api_client.force_authenticate(parent)
        api_client.post(read_url(conversation))
        api_client.post(read_url(conversation))

        assert MessageRead.objects.count() == 1

    def test_unread_count_is_per_user(
        self, api_client, parent, other_parent, conversation
    ):
        api_client.force_authenticate(parent)
        api_client.post(read_url(conversation))

        api_client.force_authenticate(other_parent)
        # The other parent cannot see this conversation at all.
        assert api_client.get(UNREAD_URL).data["unread"] == 0

    def test_conversation_list_reports_its_own_unread_count(
        self, api_client, parent, conversation
    ):
        api_client.force_authenticate(parent)

        response = api_client.get(LIST_URL)

        assert response.data["results"][0]["unread_count"] == 1

    def test_is_mine_reflects_the_viewer(
        self, api_client, staff, parent, conversation
    ):
        api_client.force_authenticate(staff)
        staff_view = api_client.get(messages_url(conversation))
        assert staff_view.data["results"][0]["is_mine"] is True

        api_client.force_authenticate(parent)
        parent_view = api_client.get(messages_url(conversation))
        assert parent_view.data["results"][0]["is_mine"] is False


@pytest.mark.django_db
class TestConversationList:
    def test_shows_a_preview_of_the_latest_message(
        self, api_client, staff, conversation
    ):
        api_client.force_authenticate(staff)
        api_client.post(messages_url(conversation), {"body": "Le plus récent"})

        response = api_client.get(LIST_URL)

        assert response.data["results"][0]["last_message"]["body"] == "Le plus récent"

    def test_includes_the_child(self, api_client, parent, conversation):
        api_client.force_authenticate(parent)

        response = api_client.get(LIST_URL)

        assert response.data["results"][0]["child"]["first_name"] == "Mohamed"

    def test_query_count_does_not_grow_with_conversations(
        self, api_client, staff, owned_child, make_child
    ):
        """The list must not become an N+1 as the nursery fills up."""
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        api_client.force_authenticate(staff)

        def make(n):
            for i in range(n):
                child = make_child(first_name=f"Enfant{i}")
                convo = Conversation.objects.create(child=child)
                Message.objects.create(conversation=convo, sender=staff, body=f"m{i}")

        make(2)
        api_client.get(LIST_URL)
        with CaptureQueriesContext(connection) as small:
            api_client.get(LIST_URL)

        make(8)
        with CaptureQueriesContext(connection) as large:
            response = api_client.get(LIST_URL)

        assert response.data["count"] == 10
        assert len(small.captured_queries) == len(large.captured_queries), (
            f"{len(small.captured_queries)} -> {len(large.captured_queries)}: N+1"
        )


@pytest.mark.django_db
class TestAnonymousDegradesCleanly:
    def test_queryset_is_empty_for_an_anonymous_user(self, conversation):
        """The unread annotation compares against a user id, so an
        anonymous request must return nothing rather than raise."""
        from django.contrib.auth.models import AnonymousUser
        from rest_framework.test import APIRequestFactory

        from apps.messaging.views import ConversationViewSet

        request = APIRequestFactory().get("/api/conversations/")
        request.user = AnonymousUser()

        view = ConversationViewSet()
        view.request = request
        view.format_kwarg = None

        assert view.get_queryset().count() == 0
