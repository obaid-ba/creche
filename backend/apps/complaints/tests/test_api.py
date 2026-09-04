"""Complaint tests (brief 14, 27; docs/api.md 10)."""
import pytest
from django.urls import reverse

from apps.complaints.models import (
    ALLOWED_TRANSITIONS,
    Complaint,
    ComplaintReply,
    ComplaintStatus,
    IllegalTransition,
)

LIST_URL = reverse("complaint-list")


def detail_url(complaint):
    return reverse("complaint-detail", args=[complaint.id])


def status_url(complaint):
    return reverse("complaint-change-status", args=[complaint.id])


def replies_url(complaint):
    return reverse("complaint-replies", args=[complaint.id])


@pytest.fixture
def complaint(db, parent, owned_child):
    return Complaint.objects.create(
        parent=parent.parent_profile,
        child=owned_child,
        subject="Horaires du soir",
        message="Serait-il possible d'ajuster l'heure de sortie ?",
    )


class TestStateMachine:
    """The transitions are enforced on the model, so every caller is bound."""

    @pytest.mark.parametrize(
        ("current", "target", "allowed"),
        [
            ("NEW", "IN_PROGRESS", True),
            ("NEW", "CLOSED", True),
            ("NEW", "RESOLVED", False),
            ("IN_PROGRESS", "RESOLVED", True),
            ("IN_PROGRESS", "CLOSED", True),
            ("IN_PROGRESS", "NEW", False),
            ("RESOLVED", "CLOSED", True),
            ("RESOLVED", "IN_PROGRESS", True),
            ("RESOLVED", "NEW", False),
            ("CLOSED", "NEW", False),
            ("CLOSED", "IN_PROGRESS", False),
            ("CLOSED", "RESOLVED", False),
        ],
    )
    def test_transition_matrix(self, current, target, allowed):
        complaint = Complaint(status=current)
        assert complaint.can_transition_to(target) is allowed

    def test_closed_is_terminal(self):
        assert ALLOWED_TRANSITIONS[ComplaintStatus.CLOSED] == set()

    def test_every_status_has_a_rule(self):
        assert set(ALLOWED_TRANSITIONS) == set(ComplaintStatus.values)

    @pytest.mark.django_db
    def test_transitioning_to_the_same_status_is_illegal(self, complaint):
        with pytest.raises(IllegalTransition):
            complaint.transition_to(ComplaintStatus.NEW)

    @pytest.mark.django_db
    def test_resolving_stamps_the_time(self, complaint):
        complaint.transition_to(ComplaintStatus.IN_PROGRESS)
        complaint.transition_to(ComplaintStatus.RESOLVED)

        assert complaint.resolved_at is not None

    @pytest.mark.django_db
    def test_reopening_clears_the_resolved_time(self, complaint):
        """A parent saying "it is still happening" reopens rather than
        forcing a second complaint."""
        complaint.transition_to(ComplaintStatus.IN_PROGRESS)
        complaint.transition_to(ComplaintStatus.RESOLVED)
        complaint.transition_to(ComplaintStatus.IN_PROGRESS)

        assert complaint.resolved_at is None
        assert complaint.status == ComplaintStatus.IN_PROGRESS


@pytest.mark.django_db
class TestOwnership:
    def test_parent_sees_only_their_own(
        self, api_client, parent, other_parent, complaint
    ):
        Complaint.objects.create(
            parent=other_parent.parent_profile, subject="Autre", message="…"
        )
        api_client.force_authenticate(parent)

        response = api_client.get(LIST_URL)

        assert response.data["count"] == 1
        assert response.data["results"][0]["subject"] == "Horaires du soir"

    def test_parent_cannot_open_another_familys_complaint(
        self, api_client, other_parent, complaint
    ):
        api_client.force_authenticate(other_parent)

        assert api_client.get(detail_url(complaint)).status_code == 404

    def test_staff_see_every_complaint(self, api_client, staff, complaint):
        api_client.force_authenticate(staff)

        assert api_client.get(LIST_URL).data["count"] == 1

    def test_anonymous_is_rejected(self, api_client):
        assert api_client.get(LIST_URL).status_code == 401


@pytest.mark.django_db
class TestCreation:
    def test_parent_can_file_one(self, api_client, parent, owned_child):
        api_client.force_authenticate(parent)

        response = api_client.post(
            LIST_URL,
            {
                "subject": "Repas",
                "message": "Mon enfant a peu mangé cette semaine.",
                "child_id": str(owned_child.id),
            },
        )

        assert response.status_code == 201
        assert response.data["status"] == ComplaintStatus.NEW
        assert response.data["status_label"] == "Nouvelle"

    def test_child_is_optional(self, api_client, parent):
        api_client.force_authenticate(parent)

        response = api_client.post(
            LIST_URL, {"subject": "Général", "message": "Une question."}
        )

        assert response.status_code == 201
        assert response.data["child"] is None

    def test_cannot_file_about_another_familys_child(
        self, api_client, other_parent, owned_child
    ):
        api_client.force_authenticate(other_parent)

        response = api_client.post(
            LIST_URL,
            {
                "subject": "X",
                "message": "Y",
                "child_id": str(owned_child.id),
            },
        )

        assert response.status_code == 404
        assert Complaint.objects.count() == 0

    def test_staff_cannot_file_one(self, api_client, staff):
        api_client.force_authenticate(staff)

        response = api_client.post(LIST_URL, {"subject": "X", "message": "Y"})

        assert response.status_code == 403

    def test_blank_subject_is_rejected(self, api_client, parent):
        api_client.force_authenticate(parent)

        response = api_client.post(LIST_URL, {"subject": "   ", "message": "Y"})

        assert response.status_code == 400


@pytest.mark.django_db
class TestStatusEndpoint:
    def test_staff_can_advance(self, api_client, staff, complaint):
        api_client.force_authenticate(staff)

        response = api_client.patch(
            status_url(complaint), {"status": ComplaintStatus.IN_PROGRESS}
        )

        assert response.status_code == 200
        assert response.data["status"] == ComplaintStatus.IN_PROGRESS

    def test_illegal_transition_is_409_not_400(
        self, api_client, staff, complaint
    ):
        """The payload is a valid status; the state machine forbids the move."""
        api_client.force_authenticate(staff)

        response = api_client.patch(
            status_url(complaint), {"status": ComplaintStatus.RESOLVED}
        )

        assert response.status_code == 409
        complaint.refresh_from_db()
        assert complaint.status == ComplaintStatus.NEW

    def test_an_unknown_status_is_400(self, api_client, staff, complaint):
        api_client.force_authenticate(staff)

        response = api_client.patch(status_url(complaint), {"status": "BANANA"})

        assert response.status_code == 400

    def test_parent_cannot_change_status(self, api_client, parent, complaint):
        api_client.force_authenticate(parent)

        response = api_client.patch(
            status_url(complaint), {"status": ComplaintStatus.CLOSED}
        )

        assert response.status_code == 403

    def test_a_closed_complaint_cannot_be_reopened(
        self, api_client, staff, complaint
    ):
        api_client.force_authenticate(staff)
        api_client.patch(status_url(complaint), {"status": ComplaintStatus.CLOSED})

        response = api_client.patch(
            status_url(complaint), {"status": ComplaintStatus.IN_PROGRESS}
        )

        assert response.status_code == 409

    def test_status_change_is_audited(self, api_client, staff, complaint):
        from apps.audit.models import AuditAction, AuditLog

        api_client.force_authenticate(staff)
        api_client.patch(
            status_url(complaint), {"status": ComplaintStatus.IN_PROGRESS}
        )

        entry = AuditLog.objects.filter(
            action=AuditAction.COMPLAINT_STATUS_CHANGED
        ).first()
        assert entry is not None
        assert entry.metadata["previous"] == "NEW"
        assert entry.metadata["new"] == "IN_PROGRESS"

    def test_allowed_transitions_are_offered_to_staff_only(
        self, api_client, staff, parent, complaint
    ):
        api_client.force_authenticate(staff)
        staff_view = api_client.get(detail_url(complaint))
        assert set(staff_view.data["allowed_transitions"]) == {
            "IN_PROGRESS",
            "CLOSED",
        }

        api_client.force_authenticate(parent)
        parent_view = api_client.get(detail_url(complaint))
        assert parent_view.data["allowed_transitions"] == []


@pytest.mark.django_db
class TestReplies:
    def test_staff_can_reply(self, api_client, staff, complaint):
        api_client.force_authenticate(staff)

        response = api_client.post(
            replies_url(complaint), {"body": "Nous regardons cela."}
        )

        assert response.status_code == 201
        assert len(response.data["replies"]) == 1

    def test_parent_can_reply_on_their_own(self, api_client, parent, complaint):
        api_client.force_authenticate(parent)

        response = api_client.post(replies_url(complaint), {"body": "Merci."})

        assert response.status_code == 201

    def test_internal_notes_are_hidden_from_the_parent(
        self, api_client, staff, parent, complaint
    ):
        """The rule that matters: staff working notes must never reach the
        family the complaint is about."""
        api_client.force_authenticate(staff)
        api_client.post(
            replies_url(complaint),
            {"body": "Vérifier avec l'équipe du soir.", "is_internal": True},
        )
        api_client.post(replies_url(complaint), {"body": "Bonjour, nous regardons."})

        api_client.force_authenticate(parent)
        response = api_client.get(detail_url(complaint))

        bodies = [r["body"] for r in response.data["replies"]]
        assert bodies == ["Bonjour, nous regardons."]
        assert "Vérifier avec l'équipe du soir." not in str(response.data)

    def test_staff_do_see_internal_notes(self, api_client, staff, complaint):
        api_client.force_authenticate(staff)
        api_client.post(
            replies_url(complaint), {"body": "Note interne", "is_internal": True}
        )

        response = api_client.get(detail_url(complaint))

        assert len(response.data["replies"]) == 1
        assert response.data["replies"][0]["is_internal"] is True

    def test_parent_cannot_post_an_internal_note(
        self, api_client, parent, complaint
    ):
        api_client.force_authenticate(parent)

        response = api_client.post(
            replies_url(complaint), {"body": "Test", "is_internal": True}
        )

        assert response.status_code == 403
        assert ComplaintReply.objects.count() == 0

    def test_a_non_owner_cannot_reply(
        self, api_client, other_parent, complaint
    ):
        api_client.force_authenticate(other_parent)

        response = api_client.post(replies_url(complaint), {"body": "Coucou"})

        assert response.status_code == 404

    def test_empty_reply_is_rejected(self, api_client, staff, complaint):
        api_client.force_authenticate(staff)

        assert api_client.post(replies_url(complaint), {"body": "  "}).status_code == 400


@pytest.mark.django_db
class TestFilteringAndAssignment:
    def test_filter_by_status(self, api_client, staff, parent, complaint):
        other = Complaint.objects.create(
            parent=parent.parent_profile, subject="Autre", message="…"
        )
        other.transition_to(ComplaintStatus.IN_PROGRESS)
        api_client.force_authenticate(staff)

        response = api_client.get(LIST_URL, {"status": "IN_PROGRESS"})

        assert [c["subject"] for c in response.data["results"]] == ["Autre"]

    def test_staff_can_filter_by_child(
        self, api_client, staff, parent, complaint, owned_child
    ):
        Complaint.objects.create(
            parent=parent.parent_profile, subject="Sans enfant", message="…"
        )
        api_client.force_authenticate(staff)

        response = api_client.get(LIST_URL, {"child": str(owned_child.id)})

        assert [c["subject"] for c in response.data["results"]] == ["Horaires du soir"]

    def test_only_admin_can_assign(self, api_client, staff, admin, complaint):
        url = reverse("complaint-assign", args=[complaint.id])
        api_client.force_authenticate(staff)
        assert api_client.patch(
            url, {"staff_id": str(staff.staff_profile.pk)}
        ).status_code == 403

        api_client.force_authenticate(admin)
        response = api_client.patch(url, {"staff_id": str(staff.staff_profile.pk)})
        assert response.status_code == 200

    def test_first_status_change_assigns_the_actor(
        self, api_client, staff, complaint
    ):
        api_client.force_authenticate(staff)
        api_client.patch(
            status_url(complaint), {"status": ComplaintStatus.IN_PROGRESS}
        )

        complaint.refresh_from_db()
        assert complaint.assigned_to_id == staff.staff_profile.pk
