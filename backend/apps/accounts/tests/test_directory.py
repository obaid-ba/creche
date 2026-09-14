"""Parent and staff directory tests (brief §20).

These endpoints list adults' personal data, so who may read and change
what is the whole point.
"""
import pytest
from django.urls import reverse

from apps.accounts.models import Role, StaffProfile, User

PARENTS_URL = reverse("parent-list")
STAFF_URL = reverse("staff-list")


@pytest.mark.django_db
class TestParentDirectoryAccess:
    def test_parents_cannot_read_the_parent_directory(self, api_client, parent):
        """It lists every family's contact details."""
        api_client.force_authenticate(parent)

        assert api_client.get(PARENTS_URL).status_code == 403

    def test_staff_can_read_it(self, api_client, staff, parent):
        api_client.force_authenticate(staff)

        assert api_client.get(PARENTS_URL).status_code == 200

    def test_anonymous_is_rejected(self, api_client):
        assert api_client.get(PARENTS_URL).status_code == 401


@pytest.mark.django_db
class TestParentDirectoryContent:
    def test_lists_parents_with_their_children(
        self, api_client, staff, parent, owned_child
    ):
        api_client.force_authenticate(staff)

        response = api_client.get(PARENTS_URL)
        row = next(
            r for r in response.data["results"] if r["email"] == parent.email
        )

        assert [c["first_name"] for c in row["children"]] == ["Mohamed"]

    def test_revoked_guardianships_are_excluded(
        self, api_client, staff, parent, owned_child, link_parent_to_child
    ):
        from apps.accounts.models import Guardianship

        Guardianship.objects.filter(child=owned_child).update(
            revoked_at="2026-01-01T00:00:00Z"
        )
        api_client.force_authenticate(staff)

        row = next(
            r
            for r in api_client.get(PARENTS_URL).data["results"]
            if r["email"] == parent.email
        )
        assert row["children"] == []

    def test_search_matches_the_parent(self, api_client, staff, parent):
        parent.first_name = "Sarah"
        parent.save(update_fields=["first_name"])
        api_client.force_authenticate(staff)

        response = api_client.get(PARENTS_URL, {"search": "Sarah"})

        assert response.data["count"] == 1

    def test_search_also_matches_the_child(
        self, api_client, staff, parent, owned_child
    ):
        """Staff usually remember the child's name, not the parent's."""
        api_client.force_authenticate(staff)

        response = api_client.get(PARENTS_URL, {"search": "Mohamed"})

        assert response.data["count"] == 1
        assert response.data["results"][0]["email"] == parent.email

    def test_can_filter_to_parents_with_no_child(
        self, api_client, staff, parent, other_parent, owned_child
    ):
        api_client.force_authenticate(staff)

        response = api_client.get(PARENTS_URL, {"unlinked": "true"})

        emails = [r["email"] for r in response.data["results"]]
        assert other_parent.email in emails
        assert parent.email not in emails


@pytest.mark.django_db
class TestStaffDirectory:
    def test_parents_cannot_read_it(self, api_client, parent):
        api_client.force_authenticate(parent)

        assert api_client.get(STAFF_URL).status_code == 403

    def test_staff_can_read_it(self, api_client, staff):
        api_client.force_authenticate(staff)

        assert api_client.get(STAFF_URL).status_code == 200

    def test_staff_cannot_create_an_account(self, api_client, staff):
        """Creating colleagues is an admin action."""
        api_client.force_authenticate(staff)

        response = api_client.post(
            STAFF_URL,
            {
                "email": "new@mamati.test", "first_name": "New",
                "last_name": "Person", "password": "StrongPass!2345",
            },
        )

        assert response.status_code == 403

    def test_admin_can_create_an_account(self, api_client, admin):
        api_client.force_authenticate(admin)

        response = api_client.post(
            STAFF_URL,
            {
                "email": "new@mamati.test", "first_name": "New",
                "last_name": "Person", "password": "StrongPass!2345",
                "job_title": "Éducatrice",
            },
        )

        assert response.status_code == 201
        created = User.objects.get(email="new@mamati.test")
        assert created.role == Role.STAFF
        assert hasattr(created, "staff_profile")

    def test_a_weak_password_is_rejected(self, api_client, admin):
        api_client.force_authenticate(admin)

        response = api_client.post(
            STAFF_URL,
            {
                "email": "new@mamati.test", "first_name": "N",
                "last_name": "P", "password": "12345",
            },
        )

        assert response.status_code == 400
        assert not User.objects.filter(email="new@mamati.test").exists()

    def test_a_duplicate_email_is_rejected(self, api_client, admin, staff):
        api_client.force_authenticate(admin)

        response = api_client.post(
            STAFF_URL,
            {
                "email": staff.email, "first_name": "N", "last_name": "P",
                "password": "StrongPass!2345",
            },
        )

        assert response.status_code == 400

    def test_admin_can_grant_admin(self, api_client, admin):
        api_client.force_authenticate(admin)

        response = api_client.post(
            STAFF_URL,
            {
                "email": "boss@mamati.test", "first_name": "B", "last_name": "S",
                "password": "StrongPass!2345", "role": "ADMIN",
            },
        )

        assert response.status_code == 201
        assert User.objects.get(email="boss@mamati.test").role == Role.ADMIN

    def test_a_parent_role_cannot_be_created_here(self, api_client, admin):
        """This endpoint mints staff; parents arrive through the code claim."""
        api_client.force_authenticate(admin)

        response = api_client.post(
            STAFF_URL,
            {
                "email": "p@mamati.test", "first_name": "P", "last_name": "P",
                "password": "StrongPass!2345", "role": "PARENT",
            },
        )

        assert response.status_code == 400


@pytest.mark.django_db
class TestStaffDeactivation:
    def test_admin_deactivates_rather_than_deletes(
        self, api_client, admin, staff
    ):
        """Deleting would strip the name from every audit entry."""
        api_client.force_authenticate(admin)

        response = api_client.post(
            reverse("staff-deactivate", args=[staff.staff_profile.pk])
        )

        assert response.status_code == 200
        staff.refresh_from_db()
        assert staff.is_active is False
        assert User.objects.filter(pk=staff.pk).exists()

    def test_a_deactivated_account_cannot_log_in(
        self, api_client, admin, staff
    ):
        api_client.force_authenticate(admin)
        api_client.post(reverse("staff-deactivate", args=[staff.staff_profile.pk]))
        api_client.force_authenticate(None)

        response = api_client.post(
            reverse("auth-login"),
            {"email": staff.email, "password": "TestPass!2345"},
        )

        assert response.status_code == 400

    def test_admin_cannot_lock_themselves_out(self, api_client, admin):
        api_client.force_authenticate(admin)

        response = api_client.post(
            reverse("staff-deactivate", args=[admin.staff_profile.pk])
        )

        assert response.status_code == 409
        admin.refresh_from_db()
        assert admin.is_active is True

    def test_reactivation_restores_access(self, api_client, admin, staff):
        api_client.force_authenticate(admin)
        api_client.post(reverse("staff-deactivate", args=[staff.staff_profile.pk]))

        api_client.post(reverse("staff-reactivate", args=[staff.staff_profile.pk]))

        staff.refresh_from_db()
        assert staff.is_active is True

    def test_staff_cannot_deactivate_a_colleague(
        self, api_client, staff, make_user
    ):
        other = make_user(email="colleague@mamati.test", role=Role.STAFF)
        api_client.force_authenticate(staff)

        response = api_client.post(
            reverse("staff-deactivate", args=[other.staff_profile.pk])
        )

        assert response.status_code == 403
