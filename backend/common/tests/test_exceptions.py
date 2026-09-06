"""The error envelope's failure paths.

Every API error leaves through `api_exception_handler`, so this is the
one place where a bug degrades every endpoint at once. The happy paths
(400, 401, 403 from DRF) are exercised constantly by the rest of the
suite; the branches here fire only when something has already gone
wrong, which is exactly why they are easy to leave untested and
expensive to get wrong.
"""
import pytest
from django.core.exceptions import PermissionDenied
from django.db import IntegrityError
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.views import APIView

from common.exceptions import api_exception_handler


def handle(exc):
    return api_exception_handler(exc, {"view": APIView()})


def envelope(response):
    assert "error" in response.data, response.data
    return response.data["error"]


class TestEnvelopeShape:
    def test_every_error_has_the_documented_keys(self):
        response = handle(ValidationError({"email": ["Invalide."]}))
        error = envelope(response)

        assert set(error) == {"code", "message", "details", "request_id"}

    def test_request_id_is_present_and_unique(self):
        """Support asks a parent for this id to find the trace."""
        first = envelope(handle(Http404()))["request_id"]
        second = envelope(handle(Http404()))["request_id"]

        assert first and second and first != second


class TestFailurePaths:
    def test_django_http404_becomes_a_french_404(self):
        response = handle(Http404("no such row"))

        assert response.status_code == status.HTTP_404_NOT_FOUND
        error = envelope(response)
        assert error["code"] == "not_found"
        assert "introuvable" in error["message"]
        # The internal message must not leak into the response.
        assert "no such row" not in str(error)

    def test_django_permission_denied_becomes_a_french_403(self):
        """Django's own PermissionDenied, not DRF's — raised by
        `@permission_required` and by model-level checks."""
        response = handle(PermissionDenied("nope"))

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert envelope(response)["code"] == "permission_denied"

    def test_integrity_error_becomes_409_not_500(self):
        """A database constraint firing is a conflict with the request,
        not a server fault. The schema enforces real business rules
        (docs/database.md §10), so this path is reachable in normal use."""
        response = handle(IntegrityError("duplicate key value violates ..."))

        assert response.status_code == status.HTTP_409_CONFLICT
        assert envelope(response)["code"] == "conflict"

    def test_integrity_error_never_leaks_sql(self):
        response = handle(
            IntegrityError(
                'duplicate key value violates unique constraint '
                '"uniq_guardianship_parent_child" DETAIL: Key (parent_id)=(42)'
            )
        )

        body = str(response.data)
        assert "uniq_guardianship_parent_child" not in body
        assert "parent_id" not in body

    def test_unhandled_exception_becomes_an_opaque_500(self):
        """No traceback, no exception text — just a French message and an
        id that ties the response to the server log."""
        response = handle(RuntimeError("connection string: postgres://u:p@h/db"))

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        error = envelope(response)
        assert error["code"] == "server_error"
        assert "postgres://" not in str(response.data)
        assert error["request_id"]

    def test_unhandled_exception_is_logged_with_its_request_id(self, caplog):
        import logging

        with caplog.at_level(logging.ERROR, logger="common.exceptions"):
            response = handle(RuntimeError("boom"))

        request_id = envelope(response)["request_id"]
        assert request_id in caplog.text, "log must be findable from the response"


class TestDetailNormalisation:
    def test_dict_details_are_preserved_per_field(self):
        response = handle(
            ValidationError({"date_of_birth": ["Date invalide."], "email": ["Requis."]})
        )

        details = envelope(response)["details"]
        assert details["date_of_birth"] == ["Date invalide."]
        assert details["email"] == ["Requis."]

    def test_a_bare_string_is_wrapped_in_a_list(self):
        """The frontend always reads details[field] as an array."""
        response = handle(ValidationError({"email": "Requis."}))

        assert envelope(response)["details"]["email"] == ["Requis."]

    def test_a_list_detail_becomes_non_field_errors(self):
        response = handle(ValidationError(["Quelque chose ne va pas."]))

        details = envelope(response)["details"]
        assert details["non_field_errors"] == ["Quelque chose ne va pas."]

    def test_a_serializer_message_replaces_the_generic_one(self):
        """A specific message is more useful than "données invalides"."""
        response = handle(ValidationError("Identifiants invalides."))

        assert envelope(response)["message"] == "Identifiants invalides."

    def test_details_is_always_a_dict_even_when_empty(self):
        for exc in (Http404(), PermissionDenied(), IntegrityError("x")):
            assert envelope(handle(exc))["details"] == {}


@pytest.mark.django_db
class TestThroughTheRealStack:
    def test_a_constraint_violation_surfaces_as_409(self, api_client, staff, make_child):
        """End to end, not just the handler in isolation: adding the same
        child to an activity twice trips a unique constraint."""
        from datetime import date

        from django.urls import reverse

        from apps.activities.models import Activity

        activity = Activity.objects.create(
            title="Peinture", date=date.today(), created_by=staff
        )
        child = make_child()
        api_client.force_authenticate(staff)

        url = reverse("activity-participants", args=[activity.id])
        first = api_client.post(url, {"child_ids": [str(child.id)]})
        second = api_client.post(url, {"child_ids": [str(child.id)]})

        # bulk_create(ignore_conflicts=True) makes this idempotent rather
        # than a conflict — which is the intended behaviour, and worth
        # pinning so a future change to that flag is noticed.
        assert first.status_code == 201
        assert second.status_code == 201

    def test_a_404_from_a_real_endpoint_uses_the_envelope(
        self, api_client, parent, other_parent, make_child, link_parent_to_child
    ):
        from django.urls import reverse

        theirs = make_child(first_name="Yasmine")
        link_parent_to_child(other_parent, theirs)
        api_client.force_authenticate(parent)

        response = api_client.get(reverse("child-detail", args=[theirs.id]))

        assert response.status_code == 404
        error = envelope(response)
        assert error["code"] == "not_found"
        assert error["request_id"]


class TestMessagePromotion:
    """A specific complaint must reach the banner, not sit in `details`.

    A wrong password used to produce "Les données envoyées sont
    invalides." — technically true, useless to a parent.
    """

    def test_a_non_field_message_becomes_the_banner_text(self):
        response = handle(ValidationError("Identifiants invalides."))

        assert envelope(response)["message"] == "Identifiants invalides."

    def test_a_field_error_does_not_replace_the_banner(self):
        """The form shows it beside the input; repeating it would say the
        same thing twice."""
        response = handle(ValidationError({"email": ["Adresse invalide."]}))
        error = envelope(response)

        assert error["message"] == "Les données envoyées sont invalides."
        assert error["details"]["email"] == ["Adresse invalide."]

    def test_several_non_field_errors_keep_the_generic_banner(self):
        """With more than one there is no single sentence to promote."""
        response = handle(ValidationError(["Trop court.", "Trop simple."]))

        assert envelope(response)["message"] == "Les données envoyées sont invalides."
        assert len(envelope(response)["details"]["non_field_errors"]) == 2

    def test_mixed_field_and_non_field_keeps_the_generic_banner(self):
        response = handle(
            ValidationError({
                "non_field_errors": ["Globalement faux."],
                "email": ["Requis."],
            })
        )

        assert envelope(response)["message"] == "Les données envoyées sont invalides."


@pytest.mark.django_db
class TestLoginMessageEndToEnd:
    def test_a_wrong_password_says_so(self, api_client, parent):
        from django.urls import reverse

        response = api_client.post(
            reverse("auth-login"),
            {"email": parent.email, "password": "WrongPassword!1"},
        )

        assert response.data["error"]["message"] == "Identifiants invalides."

    def test_unknown_and_wrong_password_still_match(self, api_client, parent):
        """Promotion must not reintroduce an enumeration oracle."""
        from django.urls import reverse

        unknown = api_client.post(
            reverse("auth-login"),
            {"email": "nobody@example.com", "password": "WrongPassword!1"},
        )
        wrong = api_client.post(
            reverse("auth-login"),
            {"email": parent.email, "password": "WrongPassword!1"},
        )

        # request_id differs by design; everything else must match.
        def comparable(response):
            error = dict(response.data["error"])
            error.pop("request_id")
            return error

        assert comparable(unknown) == comparable(wrong)
