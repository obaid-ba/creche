"""Rate-limit tests (docs/authentication.md 6).

Throttling is disabled in config.settings.test so ordinary tests are not
order-dependent. These tests re-enable it explicitly.

``SimpleRateThrottle.THROTTLE_RATES`` is bound to a dict *reference* when
the class is imported, so ``override_settings(REST_FRAMEWORK=...)`` never
reaches it - DRF's settings reload builds a new dict that the class
attribute does not point at. Patching the class attribute directly is
therefore both simpler and deterministic, independent of test ordering.
"""
from unittest.mock import patch

import pytest
from django.core.cache import cache
from django.urls import reverse
from rest_framework.throttling import SimpleRateThrottle

from apps.accounts.access_codes import ChildAccessCode

PASSWORD = "TestPass!2345"


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    """Throttle counters live in the cache and would leak between tests."""
    cache.clear()
    yield
    cache.clear()


def with_rates(**rates):
    return patch.object(SimpleRateThrottle, "THROTTLE_RATES", rates)


@pytest.mark.django_db
class TestLoginThrottle:
    def test_repeated_failures_are_throttled(self, api_client, parent):
        with with_rates(login="3/hour", claim="100/hour", user="1000/hour"):
            url = reverse("auth-login")
            payload = {"email": parent.email, "password": "WrongPassword!1"}
            statuses = [api_client.post(url, payload).status_code for _ in range(5)]

        assert statuses[:3] == [400, 400, 400], statuses
        assert statuses[3:] == [429, 429], statuses

    def test_throttled_response_uses_the_french_error_envelope(
        self, api_client, parent
    ):
        with with_rates(login="1/hour", claim="100/hour", user="1000/hour"):
            url = reverse("auth-login")
            payload = {"email": parent.email, "password": "WrongPassword!1"}
            api_client.post(url, payload)
            response = api_client.post(url, payload)

        assert response.status_code == 429
        assert "error" in response.data
        assert response.data["error"]["message"]

    def test_a_successful_login_still_counts_toward_the_limit(
        self, api_client, parent
    ):
        """Otherwise an attacker could reset the counter with a valid login."""
        with with_rates(login="2/hour", claim="100/hour", user="1000/hour"):
            url = reverse("auth-login")
            api_client.post(url, {"email": parent.email, "password": PASSWORD})
            api_client.post(url, {"email": parent.email, "password": PASSWORD})
            third = api_client.post(
                url, {"email": parent.email, "password": PASSWORD}
            )

        assert third.status_code == 429


@pytest.mark.django_db
class TestCodeLoginThrottle:
    def test_code_guessing_is_throttled(self, api_client, make_child, parent):
        """The access code is the parent's standing credential, so guessing
        at it is rate-limited by address as well as locked per code."""
        child = make_child(first_name="Mohamed")
        ChildAccessCode.issue(child=child, parent=parent.parent_profile)

        with with_rates(login="100/hour", code_login="3/hour", user="1000/hour"):
            url = reverse("auth-parent-code-login")
            statuses = [
                api_client.post(
                    url,
                    {"access_code": f"MAM-ZZZZ-ZZZ{n}", "child_name": "Mohamed"},
                ).status_code
                for n in range(5)
            ]

        assert statuses[:3] == [400, 400, 400], statuses
        assert statuses[3:] == [429, 429], statuses


@pytest.mark.django_db
class TestThrottlingIsOffByDefaultInTests:
    def test_ordinary_tests_are_not_throttled(self, api_client, parent):
        url = reverse("auth-login")
        payload = {"email": parent.email, "password": "WrongPassword!1"}

        statuses = [api_client.post(url, payload).status_code for _ in range(15)]

        assert set(statuses) == {400}
