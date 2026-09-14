"""Authentication endpoint tests (docs/authentication.md 8, brief 27)."""
import pytest
from django.conf import settings
from django.urls import reverse

from apps.accounts.models import Role, User
from apps.audit.models import AuditAction, AuditLog

PASSWORD = "TestPass!2345"


def refresh_cookie(response):
    return response.cookies.get(settings.REFRESH_COOKIE_NAME)


@pytest.mark.django_db
class TestLogin:
    def test_parent_can_log_in(self, api_client, parent):
        response = api_client.post(
            reverse("auth-login"),
            {"email": parent.email, "password": PASSWORD},
        )

        assert response.status_code == 200
        assert response.data["user"]["role"] == Role.PARENT
        assert response.data["access"]

    def test_staff_can_log_in(self, api_client, staff):
        response = api_client.post(
            reverse("auth-login"),
            {"email": staff.email, "password": PASSWORD},
        )

        assert response.status_code == 200
        assert response.data["user"]["role"] == Role.STAFF

    def test_email_is_case_insensitive(self, api_client, parent):
        response = api_client.post(
            reverse("auth-login"),
            {"email": parent.email.upper(), "password": PASSWORD},
        )

        assert response.status_code == 200

    def test_wrong_password_is_rejected(self, api_client, parent):
        response = api_client.post(
            reverse("auth-login"),
            {"email": parent.email, "password": "WrongPassword!1"},
        )

        assert response.status_code == 400

    def test_inactive_user_is_rejected(self, api_client, parent):
        parent.is_active = False
        parent.save(update_fields=["is_active"])

        response = api_client.post(
            reverse("auth-login"),
            {"email": parent.email, "password": PASSWORD},
        )

        assert response.status_code == 400

    def test_unknown_and_wrong_password_are_indistinguishable(
        self, api_client, parent
    ):
        """Otherwise the endpoint enumerates which parents have accounts."""
        unknown = api_client.post(
            reverse("auth-login"),
            {"email": "nobody@example.com", "password": PASSWORD},
        )
        wrong = api_client.post(
            reverse("auth-login"),
            {"email": parent.email, "password": "WrongPassword!1"},
        )

        assert unknown.status_code == wrong.status_code
        assert unknown.data["error"]["message"] == wrong.data["error"]["message"]

    def test_refresh_token_is_an_httponly_cookie(self, api_client, parent):
        response = api_client.post(
            reverse("auth-login"),
            {"email": parent.email, "password": PASSWORD},
        )

        cookie = refresh_cookie(response)
        assert cookie is not None
        assert cookie["httponly"] is True
        assert cookie["samesite"] == "Strict"

    def test_refresh_token_is_not_in_the_response_body(self, api_client, parent):
        """The long-lived credential must never reach JavaScript."""
        response = api_client.post(
            reverse("auth-login"),
            {"email": parent.email, "password": PASSWORD},
        )

        assert "refresh" not in response.data

    def test_success_and_failure_are_audited(self, api_client, parent):
        api_client.post(
            reverse("auth-login"), {"email": parent.email, "password": PASSWORD}
        )
        api_client.post(
            reverse("auth-login"), {"email": parent.email, "password": "nope"}
        )

        assert AuditLog.objects.filter(action=AuditAction.LOGIN_SUCCESS).exists()
        assert AuditLog.objects.filter(action=AuditAction.LOGIN_FAILED).exists()


@pytest.mark.django_db
class TestRefresh:
    def _login(self, api_client, user):
        return api_client.post(
            reverse("auth-login"), {"email": user.email, "password": PASSWORD}
        )

    def test_refresh_issues_a_new_access_token(self, api_client, parent):
        self._login(api_client, parent)

        response = api_client.post(reverse("auth-refresh"))

        assert response.status_code == 200
        assert response.data["access"]

    def test_refresh_without_a_cookie_is_401(self, api_client):
        assert api_client.post(reverse("auth-refresh")).status_code == 401

    def test_rotated_refresh_token_cannot_be_reused(self, api_client, parent):
        """Replaying a rotated token must fail, so theft surfaces."""
        login = self._login(api_client, parent)
        stolen = refresh_cookie(login).value

        first = api_client.post(reverse("auth-refresh"))
        assert first.status_code == 200

        # Present the original token again, as an attacker with a copy would.
        api_client.cookies[settings.REFRESH_COOKIE_NAME] = stolen
        replay = api_client.post(reverse("auth-refresh"))

        assert replay.status_code == 401

    def test_refresh_rotates_the_cookie(self, api_client, parent):
        login = self._login(api_client, parent)
        original = refresh_cookie(login).value

        response = api_client.post(reverse("auth-refresh"))

        assert refresh_cookie(response).value != original

    def test_deactivated_user_cannot_refresh(self, api_client, parent):
        self._login(api_client, parent)
        parent.is_active = False
        parent.save(update_fields=["is_active"])

        assert api_client.post(reverse("auth-refresh")).status_code == 401

    def test_garbage_token_is_rejected(self, api_client):
        api_client.cookies[settings.REFRESH_COOKIE_NAME] = "not-a-jwt"

        assert api_client.post(reverse("auth-refresh")).status_code == 401


@pytest.mark.django_db
class TestLogout:
    def test_logout_clears_the_cookie_and_blocks_refresh(self, api_client, parent):
        api_client.post(
            reverse("auth-login"), {"email": parent.email, "password": PASSWORD}
        )

        response = api_client.post(reverse("auth-logout"))
        assert response.status_code == 204

        assert api_client.post(reverse("auth-refresh")).status_code == 401

    def test_logout_without_a_session_still_succeeds(self, api_client):
        assert api_client.post(reverse("auth-logout")).status_code == 204


@pytest.mark.django_db
class TestMe:
    def test_requires_authentication(self, api_client):
        assert api_client.get(reverse("auth-me")).status_code == 401

    def test_returns_the_current_user(self, api_client, parent):
        api_client.force_authenticate(parent)

        response = api_client.get(reverse("auth-me"))

        assert response.status_code == 200
        assert response.data["email"] == parent.email

    def test_lists_only_the_parents_own_children(
        self, api_client, parent, other_parent, make_child, link_parent_to_child
    ):
        mine = make_child(first_name="Mohamed")
        theirs = make_child(first_name="Yasmine")
        link_parent_to_child(parent, mine)
        link_parent_to_child(other_parent, theirs)

        api_client.force_authenticate(parent)
        response = api_client.get(reverse("auth-me"))

        names = [child["first_name"] for child in response.data["children"]]
        assert names == ["Mohamed"]

    def test_role_cannot_be_escalated_through_profile_update(
        self, api_client, parent
    ):
        """`role` is read-only: a parent must not be able to become admin."""
        api_client.force_authenticate(parent)

        response = api_client.patch(reverse("auth-me"), {"role": Role.ADMIN})

        assert response.status_code == 200
        parent.refresh_from_db()
        assert parent.role == Role.PARENT

    def test_can_update_own_name(self, api_client, parent):
        api_client.force_authenticate(parent)

        response = api_client.patch(reverse("auth-me"), {"first_name": "Sarah"})

        assert response.status_code == 200
        parent.refresh_from_db()
        assert parent.first_name == "Sarah"


@pytest.mark.django_db
class TestPasswordChange:
    def test_changes_the_password(self, api_client, parent):
        api_client.force_authenticate(parent)

        response = api_client.post(
            reverse("auth-password-change"),
            {"current_password": PASSWORD, "new_password": "BrandNew!98765"},
        )

        assert response.status_code == 204
        parent.refresh_from_db()
        assert parent.check_password("BrandNew!98765")

    def test_wrong_current_password_is_rejected(self, api_client, parent):
        api_client.force_authenticate(parent)

        response = api_client.post(
            reverse("auth-password-change"),
            {"current_password": "wrong", "new_password": "BrandNew!98765"},
        )

        assert response.status_code == 400
        parent.refresh_from_db()
        assert parent.check_password(PASSWORD)

    def test_weak_new_password_is_rejected(self, api_client, parent):
        api_client.force_authenticate(parent)

        response = api_client.post(
            reverse("auth-password-change"),
            {"current_password": PASSWORD, "new_password": "12345"},
        )

        assert response.status_code == 400
        assert "new_password" in response.data["error"]["details"]

    def test_requires_authentication(self, api_client):
        response = api_client.post(
            reverse("auth-password-change"),
            {"current_password": PASSWORD, "new_password": "BrandNew!98765"},
        )
        assert response.status_code == 401


@pytest.mark.django_db
class TestCurrentUserChildren:
    """`children` on /me means "my children" and is parent-only.

    For staff it would otherwise return every child in the nursery, making
    the login payload grow without bound.
    """

    def test_staff_children_list_is_empty(self, api_client, staff, make_child):
        make_child(first_name="Mohamed")
        make_child(first_name="Yasmine")

        api_client.force_authenticate(staff)
        response = api_client.get(reverse("auth-me"))

        assert response.data["children"] == []

    def test_admin_children_list_is_empty(self, api_client, admin, make_child):
        make_child()

        api_client.force_authenticate(admin)
        response = api_client.get(reverse("auth-me"))

        assert response.data["children"] == []

    def test_staff_login_payload_does_not_grow_with_the_nursery(
        self, api_client, staff, make_child
    ):
        for index in range(5):
            make_child(first_name=f"Enfant{index}")

        response = api_client.post(
            reverse("auth-login"),
            {"email": staff.email, "password": PASSWORD},
        )

        assert response.data["user"]["children"] == []

    def test_parent_still_sees_their_own_children(
        self, api_client, parent, make_child, link_parent_to_child
    ):
        link_parent_to_child(parent, make_child(first_name="Mohamed"))

        api_client.force_authenticate(parent)
        response = api_client.get(reverse("auth-me"))

        assert [c["first_name"] for c in response.data["children"]] == ["Mohamed"]


@pytest.mark.django_db
class TestProfileUpdate:
    """/auth/me/ writes through to the role-specific profile, so the
    profile screen is one request and one form (brief §20)."""

    def test_parent_updates_their_address(self, api_client, parent):
        api_client.force_authenticate(parent)

        response = api_client.patch(
            reverse("auth-me"),
            {"address": "12 rue des Oliviers", "emergency_phone": "98 765 432"},
        )

        assert response.status_code == 200
        parent.parent_profile.refresh_from_db()
        assert parent.parent_profile.address == "12 rue des Oliviers"
        assert parent.parent_profile.emergency_phone == "98 765 432"

    def test_name_and_profile_update_together(self, api_client, parent):
        api_client.force_authenticate(parent)

        api_client.patch(
            reverse("auth-me"),
            {"first_name": "Sarah", "phone": "99 111 222",
             "address": "Bizerte"},
        )

        parent.refresh_from_db()
        parent.parent_profile.refresh_from_db()
        assert parent.first_name == "Sarah"
        assert parent.phone == "99 111 222"
        assert parent.parent_profile.address == "Bizerte"

    def test_parent_only_fields_are_absent_for_staff(self, api_client, staff):
        """Returning nulls the form would have to special-case is worse
        than omitting fields that do not apply."""
        api_client.force_authenticate(staff)

        data = api_client.get(reverse("auth-me")).data

        assert "address" not in data
        assert "emergency_phone" not in data
        assert "job_title" in data

    def test_staff_only_fields_are_absent_for_parents(self, api_client, parent):
        api_client.force_authenticate(parent)

        data = api_client.get(reverse("auth-me")).data

        assert "job_title" not in data
        assert "address" in data

    def test_role_still_cannot_be_escalated(self, api_client, parent):
        api_client.force_authenticate(parent)

        api_client.patch(reverse("auth-me"), {"role": "ADMIN", "address": "x"})

        parent.refresh_from_db()
        assert parent.role == Role.PARENT
