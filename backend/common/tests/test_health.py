import pytest
from django.urls import reverse


@pytest.mark.django_db
def test_health_check_reports_database(api_client):
    response = api_client.get(reverse("health-check"))

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"


@pytest.mark.django_db
def test_health_check_needs_no_authentication(api_client):
    assert api_client.get(reverse("health-check")).status_code == 200


@pytest.mark.django_db
def test_health_check_reports_the_running_commit(api_client, monkeypatch):
    """So "is my change deployed?" has an answer that is not guesswork.

    Render injects these on every build. An un-deployed app otherwise
    looks identical to a broken one: the route 404s and nothing says the
    server is running last week's code.
    """
    monkeypatch.setenv("RENDER_GIT_COMMIT", "abc1234567890")
    monkeypatch.setenv("RENDER_GIT_BRANCH", "main")

    body = api_client.get(reverse("health-check")).json()

    assert body["version"] == "abc1234"   # short form
    assert body["branch"] == "main"


@pytest.mark.django_db
def test_health_check_is_honest_when_it_does_not_know(api_client, monkeypatch):
    """Locally there is no build to report; empty beats inventing one."""
    monkeypatch.delenv("RENDER_GIT_COMMIT", raising=False)
    monkeypatch.delenv("RENDER_GIT_BRANCH", raising=False)

    body = api_client.get(reverse("health-check")).json()

    assert body["version"] == ""
    assert body["branch"] == ""
