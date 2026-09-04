"""Shared pytest fixtures."""
import pytest
from rest_framework.test import APIClient

from apps.accounts.models import ParentProfile, Role, StaffProfile, User


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
