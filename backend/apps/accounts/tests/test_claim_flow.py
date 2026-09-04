"""Parent enrolment via child access code (docs/authentication.md 4.4)."""
import pytest
from django.urls import reverse
from django.utils import timezone

from apps.accounts.access_codes import ChildAccessCode
from apps.accounts.models import Guardianship, Role, User
from apps.audit.models import AuditAction, AuditLog
from apps.children.models import Child

PASSWORD = "TestPass!2345"


def claim_payload(code: str, **overrides):
    payload = {
        "access_code": code,
        "email": "sarah@example.com",
        "password": PASSWORD,
        "first_name": "Sarah",
        "last_name": "Benali",
        "relationship": "MOTHER",
    }
    payload.update(overrides)
    return payload


@pytest.mark.django_db
class TestParentClaim:
    def test_creates_parent_profile_and_guardianship(self, api_client, make_child):
        child = make_child()
        _, code = ChildAccessCode.issue(child=child)

        response = api_client.post(reverse("auth-parent-claim"), claim_payload(code))

        assert response.status_code == 201
        user = User.objects.get(email="sarah@example.com")
        assert user.role == Role.PARENT
        assert hasattr(user, "parent_profile")
        assert Guardianship.objects.filter(
            parent=user.parent_profile, child=child
        ).exists()

    def test_returns_a_usable_session(self, api_client, make_child):
        _, code = ChildAccessCode.issue(child=make_child())

        response = api_client.post(reverse("auth-parent-claim"), claim_payload(code))

        assert response.data["access"]
        assert len(response.data["user"]["children"]) == 1

    def test_first_claimer_becomes_the_primary_guardian(
        self, api_client, make_child
    ):
        _, code = ChildAccessCode.issue(child=make_child())

        api_client.post(reverse("auth-parent-claim"), claim_payload(code))

        assert Guardianship.objects.get().is_primary is True

    def test_code_is_consumed(self, api_client, make_child):
        _, code = ChildAccessCode.issue(child=make_child())

        api_client.post(reverse("auth-parent-claim"), claim_payload(code))

        assert ChildAccessCode.resolve(code) is None

    def test_code_cannot_be_claimed_twice(self, api_client, make_child):
        _, code = ChildAccessCode.issue(child=make_child())
        api_client.post(reverse("auth-parent-claim"), claim_payload(code))

        response = api_client.post(
            reverse("auth-parent-claim"),
            claim_payload(code, email="other@example.com"),
        )

        assert response.status_code == 400
        assert User.objects.filter(email="other@example.com").count() == 0

    def test_unknown_code_is_rejected(self, api_client, db):
        response = api_client.post(
            reverse("auth-parent-claim"), claim_payload("MAM-ZZZZZ")
        )

        assert response.status_code == 400
        assert User.objects.count() == 0

    def test_expired_code_is_rejected(self, api_client, make_child):
        from datetime import timedelta

        instance, code = ChildAccessCode.issue(child=make_child())
        instance.expires_at = timezone.now() - timedelta(seconds=1)
        instance.save(update_fields=["expires_at"])

        response = api_client.post(reverse("auth-parent-claim"), claim_payload(code))

        assert response.status_code == 400

    def test_revoked_code_is_rejected(self, api_client, make_child):
        instance, code = ChildAccessCode.issue(child=make_child())
        instance.revoke()

        response = api_client.post(reverse("auth-parent-claim"), claim_payload(code))

        assert response.status_code == 400

    def test_every_failure_mode_returns_an_identical_message(
        self, api_client, make_child
    ):
        """Unknown, expired, claimed and revoked must be indistinguishable,
        or the endpoint becomes an oracle for which codes exist."""
        from datetime import timedelta

        messages = set()

        unknown = api_client.post(
            reverse("auth-parent-claim"), claim_payload("MAM-ZZZZZ")
        )
        messages.add(str(unknown.data["error"]["details"]["access_code"]))

        expired_instance, expired = ChildAccessCode.issue(child=make_child())
        expired_instance.expires_at = timezone.now() - timedelta(seconds=1)
        expired_instance.save(update_fields=["expires_at"])
        response = api_client.post(
            reverse("auth-parent-claim"), claim_payload(expired)
        )
        messages.add(str(response.data["error"]["details"]["access_code"]))

        revoked_instance, revoked = ChildAccessCode.issue(child=make_child())
        revoked_instance.revoke()
        response = api_client.post(
            reverse("auth-parent-claim"), claim_payload(revoked)
        )
        messages.add(str(response.data["error"]["details"]["access_code"]))

        assert len(messages) == 1

    def test_code_is_accepted_in_lowercase_and_spaced(self, api_client, make_child):
        _, code = ChildAccessCode.issue(child=make_child())
        typed = code.lower().replace("-", " ")

        response = api_client.post(
            reverse("auth-parent-claim"), claim_payload(typed)
        )

        assert response.status_code == 201

    def test_weak_password_is_rejected(self, api_client, make_child):
        _, code = ChildAccessCode.issue(child=make_child())

        response = api_client.post(
            reverse("auth-parent-claim"), claim_payload(code, password="12345")
        )

        assert response.status_code == 400
        assert User.objects.count() == 0

    def test_a_rejected_claim_does_not_consume_the_code(
        self, api_client, make_child
    ):
        """The whole claim is one transaction - a late failure must not
        leave the parent locked out with a spent code."""
        _, code = ChildAccessCode.issue(child=make_child())

        api_client.post(
            reverse("auth-parent-claim"), claim_payload(code, password="12345")
        )

        assert ChildAccessCode.resolve(code) is not None

    def test_existing_email_requires_the_matching_password(
        self, api_client, parent, make_child
    ):
        """Otherwise anyone holding a code could attach a child to someone
        else's account."""
        _, code = ChildAccessCode.issue(child=make_child())

        response = api_client.post(
            reverse("auth-parent-claim"),
            claim_payload(code, email=parent.email, password="WrongPassword!1"),
        )

        assert response.status_code == 400
        assert Guardianship.objects.count() == 0

    def test_existing_parent_with_correct_password_gains_the_child(
        self, api_client, parent, make_child
    ):
        child = make_child()
        _, code = ChildAccessCode.issue(child=child)

        response = api_client.post(
            reverse("auth-parent-claim"),
            claim_payload(code, email=parent.email, password=PASSWORD),
        )

        assert response.status_code == 201
        assert Child.objects.visible_to(parent).count() == 1

    def test_staff_email_cannot_be_hijacked(self, api_client, staff, make_child):
        _, code = ChildAccessCode.issue(child=make_child())

        response = api_client.post(
            reverse("auth-parent-claim"),
            claim_payload(code, email=staff.email, password=PASSWORD),
        )

        assert response.status_code == 400
        staff.refresh_from_db()
        assert staff.role == Role.STAFF

    def test_claim_is_audited(self, api_client, make_child):
        _, code = ChildAccessCode.issue(child=make_child())

        api_client.post(reverse("auth-parent-claim"), claim_payload(code))

        assert AuditLog.objects.filter(action=AuditAction.CODE_CLAIMED).exists()

    def test_failed_claim_is_audited(self, api_client, db):
        api_client.post(reverse("auth-parent-claim"), claim_payload("MAM-ZZZZZ"))

        assert AuditLog.objects.filter(action=AuditAction.CODE_CLAIM_FAILED).exists()


@pytest.mark.django_db
class TestLinkChild:
    def test_parent_can_link_a_second_child(
        self, api_client, parent, make_child, link_parent_to_child
    ):
        link_parent_to_child(parent, make_child(first_name="Mohamed"))
        second = make_child(first_name="Yasmine")
        _, code = ChildAccessCode.issue(child=second)

        api_client.force_authenticate(parent)
        response = api_client.post(
            reverse("auth-parent-link-child"),
            {"access_code": code, "relationship": "MOTHER"},
        )

        assert response.status_code == 201
        assert Child.objects.visible_to(parent).count() == 2

    def test_requires_authentication(self, api_client, make_child):
        _, code = ChildAccessCode.issue(child=make_child())

        response = api_client.post(
            reverse("auth-parent-link-child"), {"access_code": code}
        )

        assert response.status_code == 401

    def test_staff_cannot_link_a_child_to_themselves(
        self, api_client, staff, make_child
    ):
        _, code = ChildAccessCode.issue(child=make_child())
        api_client.force_authenticate(staff)

        response = api_client.post(
            reverse("auth-parent-link-child"), {"access_code": code}
        )

        assert response.status_code == 403

    def test_invalid_code_is_rejected(self, api_client, parent):
        api_client.force_authenticate(parent)

        response = api_client.post(
            reverse("auth-parent-link-child"), {"access_code": "MAM-ZZZZZ"}
        )

        assert response.status_code == 400

    def test_second_guardian_is_not_primary(
        self, api_client, parent, other_parent, make_child, link_parent_to_child
    ):
        child = make_child()
        link_parent_to_child(parent, child, is_primary=True)
        _, code = ChildAccessCode.issue(child=child)

        api_client.force_authenticate(other_parent)
        api_client.post(reverse("auth-parent-link-child"), {"access_code": code})

        second = Guardianship.objects.get(
            parent=other_parent.parent_profile, child=child
        )
        assert second.is_primary is False
