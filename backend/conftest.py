"""Shared pytest fixtures."""
import pytest
from rest_framework.test import APIClient

from apps.accounts.models import ParentProfile, Role, StaffProfile, User


def pytest_configure(config):
    """Refuse to run against anything but the test settings.

    pytest.ini sets DJANGO_SETTINGS_MODULE, but an environment variable
    overrides it. Exporting `config.settings.dev` for a manage.py command
    and then running pytest in the same shell silently enables throttling
    and real password hashing, which fails ~19 tests in ways that look
    like application bugs. Fail loudly instead.
    """
    from django.conf import settings

    expected = "config.settings.test"
    actual = settings.SETTINGS_MODULE
    if actual != expected:
        raise pytest.UsageError(
            f"Tests must run with {expected}, not {actual}. "
            f"Unset DJANGO_SETTINGS_MODULE in your shell "
            f"(e.g. `env -u DJANGO_SETTINGS_MODULE pytest`)."
        )


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def make_user(db):
    def _make(email="user@example.com", role=Role.PARENT, password="TestPass!2345", **extra):
        user = User.objects.create_user(email=email, password=password, role=role, **extra)
        if role == Role.PARENT:
            ParentProfile.objects.create(user=user)
        else:
            StaffProfile.objects.create(user=user)
        return user

    return _make


@pytest.fixture
def parent(make_user):
    return make_user(email="parent@example.com", role=Role.PARENT)


@pytest.fixture
def other_parent(make_user):
    return make_user(email="other@example.com", role=Role.PARENT)


@pytest.fixture
def staff(make_user):
    return make_user(email="staff@example.com", role=Role.STAFF)


@pytest.fixture
def admin(make_user):
    return make_user(email="admin@example.com", role=Role.ADMIN)


@pytest.fixture
def make_child(db):
    from datetime import date

    from apps.children.models import Child

    def _make(first_name="Mohamed", last_name="Benali",
              date_of_birth=date(2024, 3, 15), **extra):
        return Child.objects.create(
            first_name=first_name, last_name=last_name,
            date_of_birth=date_of_birth, **extra
        )

    return _make


@pytest.fixture
def link_parent_to_child(db):
    from apps.accounts.models import Guardianship

    def _link(parent_user, child, **extra):
        return Guardianship.objects.create(
            parent=parent_user.parent_profile, child=child, **extra
        )

    return _link


@pytest.fixture
def owned_child(parent, make_child, link_parent_to_child):
    """A child the `parent` fixture is a guardian of."""
    child = make_child(first_name="Mohamed", last_name="Benali")
    link_parent_to_child(parent, child)
    return child


@pytest.fixture
def at_today():
    """A timezone-aware datetime at HH:MM on the local today."""
    from django.utils import timezone

    def _at(hour: int, minute: int = 0):
        return timezone.localtime().replace(
            hour=hour, minute=minute, second=0, microsecond=0
        )

    return _at


@pytest.fixture
def minutes_ago():
    """A datetime N minutes in the past.

    Prefer this over `at_today` whenever a test exercises an endpoint that
    compares against `now()` — ending an interval, rejecting future
    events. `at_today(10, 30)` is in the *future* when the suite runs
    before 10:30, which made two sleep tests fail only at night.
    """
    from django.utils import timezone

    def _ago(minutes: int):
        return timezone.now() - timezone.timedelta(minutes=minutes)

    return _ago


@pytest.fixture
def make_event(db, at_today):
    """Create a timeline event with a sensible payload for its type."""
    from apps.care.models import TimelineEvent

    DEFAULTS = {
        "BOTTLE": {"volume_ml": 180},
        "MEAL": {"meal": "LUNCH", "eaten": "MOST"},
        "TEMPERATURE": {"celsius": "36.6"},
        "MOOD": {"mood": "HAPPY"},
        "DIAPER": {"state": "WET"},
        "TOILET": {"success": True},
        "SLEEP": {},
        "NOTE": {},
    }

    def _make(child, event_type="BOTTLE", hour=8, minute=0, data=None,
              created_by=None, published=True, ended_at=None, **extra):
        return TimelineEvent.objects.create(
            child=child,
            type=event_type,
            occurred_at=at_today(hour, minute),
            ended_at=ended_at,
            data=data if data is not None else DEFAULTS.get(event_type, {}),
            created_by=created_by,
            is_published=published,
            **extra,
        )

    return _make
