"""A response must never reveal whether another family's child exists.

There are two acceptable shapes, and both are tested here because a
future refactor could silently swap one for the other:

1. Endpoints that resolve the child through the caller's own queryset
   return **404** — the row genuinely is not in their scope.
2. Endpoints gated by role return **403 before** any lookup happens, so
   the answer is identical for a real id and an invented one.

What must never happen is a response that differs between the two, which
would turn the endpoint into an oracle for "is this a real child here?".
"""
import uuid

import pytest
from django.urls import reverse


@pytest.fixture
def foreign_child(other_parent, make_child, link_parent_to_child):
    """A child belonging to a different family."""
    child = make_child(first_name="Yasmine", last_name="Haddad")
    link_parent_to_child(other_parent, child)
    return child


@pytest.fixture
def phantom_id():
    return uuid.uuid4()


@pytest.mark.django_db
class TestQuerysetScopedEndpoints:
    """These resolve through visible_to(), so both cases are 404."""

    @pytest.mark.parametrize(
        "route",
        ["child-detail", "child-timeline", "child-daily-record"],
    )
    def test_real_and_phantom_are_indistinguishable(
        self, api_client, parent, foreign_child, phantom_id, route
    ):
        api_client.force_authenticate(parent)

        real = api_client.get(reverse(route, args=[foreign_child.id]))
        phantom = api_client.get(reverse(route, args=[phantom_id]))

        assert real.status_code == 404
        assert phantom.status_code == 404
        assert real.data["error"]["code"] == phantom.data["error"]["code"]
        assert real.data["error"]["message"] == phantom.data["error"]["message"]


@pytest.mark.django_db
class TestRoleGatedEndpoints:
    """These deny on role before touching the database, so both cases are
    403 — uniform, and therefore equally uninformative."""

    def test_guardians_listing(
        self, api_client, parent, foreign_child, phantom_id
    ):
        api_client.force_authenticate(parent)

        real = api_client.get(reverse("child-guardians", args=[foreign_child.id]))
        phantom = api_client.get(reverse("child-guardians", args=[phantom_id]))

        assert real.status_code == phantom.status_code == 403
        assert real.data["error"]["message"] == phantom.data["error"]["message"]

    def test_access_code_issuing(
        self, api_client, parent, foreign_child, phantom_id
    ):
        api_client.force_authenticate(parent)
        guardian = parent.parent_profile.pk

        real = api_client.post(
            reverse("child-access-code", args=[foreign_child.id, guardian])
        )
        phantom = api_client.post(
            reverse("child-access-code", args=[phantom_id, guardian])
        )

        assert real.status_code == phantom.status_code == 403
        assert real.data["error"]["message"] == phantom.data["error"]["message"]

    def test_archiving(self, api_client, parent, foreign_child, phantom_id):
        api_client.force_authenticate(parent)

        real = api_client.post(reverse("child-archive", args=[foreign_child.id]))
        phantom = api_client.post(reverse("child-archive", args=[phantom_id]))

        assert real.status_code == phantom.status_code == 403


@pytest.mark.django_db
class TestOwnChildStillWorks:
    """The guard must not be so broad that it blocks legitimate access."""

    def test_parent_reads_their_own_child(
        self, api_client, parent, owned_child
    ):
        api_client.force_authenticate(parent)

        assert api_client.get(
            reverse("child-detail", args=[owned_child.id])
        ).status_code == 200

    def test_staff_read_any_child(self, api_client, staff, foreign_child):
        api_client.force_authenticate(staff)

        assert api_client.get(
            reverse("child-detail", args=[foreign_child.id])
        ).status_code == 200
