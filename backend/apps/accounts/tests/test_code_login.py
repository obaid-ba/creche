"""Parent sign-in by access code and child's name.

This is the parent's only route in. There is no self-registration, no
password and no email: staff create the account from the paper enrolment
form, and the family leaves with a code.

The security property that matters most here is that every failure looks
identical. A wrong code, a revoked one, a locked one and a correct code
paired with the wrong child must be indistinguishable, or the endpoint
becomes an oracle for which codes exist.
"""
import pytest
from django.test import override_settings
from django.urls import reverse

from apps.accounts.access_codes import ChildAccessCode
from apps.accounts.models import Guardianship

URL = reverse("auth-parent-code-login")


@pytest.fixture
def enrolled(make_child, parent):
    """A child, a guardian, and the code staff handed the family."""
    child = make_child(first_name="Mohamed")
    profile = parent.parent_profile
    Guardianship.objects.create(parent=profile, child=child)
    _, plain = ChildAccessCode.issue(child=child, parent=profile)
    return child, parent, plain


@pytest.mark.django_db
class TestSigningIn:
    def test_a_code_and_the_child_name_are_enough(self, api_client, enrolled):
        child, parent, plain = enrolled

        response = api_client.post(
            URL, {"access_code": plain, "child_name": child.first_name}
        )

        assert response.status_code == 200
        assert response.data["user"]["id"] == str(parent.id)
        assert response.data["access"]

    def test_the_refresh_cookie_is_set(self, api_client, enrolled):
        child, _, plain = enrolled
        response = api_client.post(
            URL, {"access_code": plain, "child_name": child.first_name}
        )
        from django.conf import settings

        assert settings.REFRESH_COOKIE_NAME in response.cookies

    @pytest.mark.parametrize("typed", ["mohamed", "MOHAMED", "  Mohamed  "])
    def test_the_name_is_forgiving(self, api_client, enrolled, typed):
        _, _, plain = enrolled
        assert api_client.post(
            URL, {"access_code": plain, "child_name": typed}
        ).status_code == 200

    def test_the_code_is_forgiving_too(self, api_client, enrolled):
        child, _, plain = enrolled
        typed = plain.lower().replace("-", " ")
        assert api_client.post(
            URL, {"access_code": typed, "child_name": child.first_name}
        ).status_code == 200

    def test_signing_in_does_not_spend_the_code(self, api_client, enrolled):
        child, _, plain = enrolled
        body = {"access_code": plain, "child_name": child.first_name}

        assert api_client.post(URL, body).status_code == 200
        assert api_client.post(URL, body).status_code == 200


@pytest.mark.django_db
class TestFailuresAreIndistinguishable:
    def _messages(self, api_client, attempts):
        seen = set()
        for body in attempts:
            response = api_client.post(URL, body)
            assert response.status_code == 400
            seen.add(str(response.data["error"]["message"]))
        return seen

    def test_every_failure_reads_the_same(self, api_client, enrolled, make_child):
        child, parent, plain = enrolled
        revoked_child = make_child(first_name="Sofia")
        _, revoked = ChildAccessCode.issue(
            child=revoked_child, parent=parent.parent_profile
        )
        ChildAccessCode.resolve(revoked).revoke()

        messages = self._messages(api_client, [
            {"access_code": "MAM-ZZZZ-ZZZZ", "child_name": "Mohamed"},
            {"access_code": plain, "child_name": "Yasmine"},
            {"access_code": revoked, "child_name": "Sofia"},
        ])

        assert len(messages) == 1, messages

    def test_a_right_code_with_a_wrong_child_does_not_sign_in(
        self, api_client, enrolled
    ):
        _, _, plain = enrolled
        response = api_client.post(
            URL, {"access_code": plain, "child_name": "Quelqu'un"}
        )
        assert response.status_code == 400
        assert "access" not in response.data

    def test_a_deactivated_parent_cannot_sign_in(self, api_client, enrolled):
        child, parent, plain = enrolled
        parent.is_active = False
        parent.save(update_fields=["is_active"])

        assert api_client.post(
            URL, {"access_code": plain, "child_name": child.first_name}
        ).status_code == 400


@pytest.mark.django_db
class TestGrinding:
    @override_settings(ACCESS_CODE_MAX_ATTEMPTS=3, ACCESS_CODE_LOCKOUT_MINUTES=60)
    def test_wrong_names_lock_the_code_itself(self, api_client, enrolled):
        """Not just the caller's address: a standing credential is worth
        grinding, and an attacker with many addresses defeats an IP
        throttle on its own."""
        child, _, plain = enrolled

        for _ in range(3):
            api_client.post(URL, {"access_code": plain, "child_name": "Faux"})

        # Even the correct pair is refused while the code is locked.
        assert api_client.post(
            URL, {"access_code": plain, "child_name": child.first_name}
        ).status_code == 400

    @override_settings(ACCESS_CODE_MAX_ATTEMPTS=3)
    def test_a_successful_sign_in_resets_the_count(self, api_client, enrolled):
        child, _, plain = enrolled
        good = {"access_code": plain, "child_name": child.first_name}

        api_client.post(URL, {"access_code": plain, "child_name": "Faux"})
        api_client.post(URL, {"access_code": plain, "child_name": "Faux"})
        assert api_client.post(URL, good).status_code == 200

        api_client.post(URL, {"access_code": plain, "child_name": "Faux"})
        assert api_client.post(URL, good).status_code == 200
