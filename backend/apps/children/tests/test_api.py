"""Child API tests (brief 27, docs/api.md 5)."""
from datetime import date, timedelta

import pytest
from dateutil.relativedelta import relativedelta
from django.urls import reverse

from apps.accounts.models import Guardianship
from apps.audit.models import AuditAction, AuditLog
from apps.children.models import Child

LIST_URL = reverse("child-list")


def detail_url(child):
    return reverse("child-detail", args=[child.id])


@pytest.mark.django_db
class TestOwnershipIsolation:
    """The control that keeps families apart. Highest-value tests here."""

    def test_parent_cannot_read_another_familys_child(
        self, api_client, parent, other_parent, make_child, link_parent_to_child
    ):
        theirs = make_child(first_name="Yasmine")
        link_parent_to_child(other_parent, theirs)
        api_client.force_authenticate(parent)

        response = api_client.get(detail_url(theirs))

        # 404 rather than 403: a 403 would confirm the child exists.
        assert response.status_code == 404

    def test_parent_list_contains_only_their_own_children(
        self, api_client, parent, other_parent, make_child, link_parent_to_child
    ):
        link_parent_to_child(parent, make_child(first_name="Mohamed"))
        link_parent_to_child(other_parent, make_child(first_name="Yasmine"))
        api_client.force_authenticate(parent)

        response = api_client.get(LIST_URL)

        names = [row["first_name"] for row in response.data["results"]]
        assert names == ["Mohamed"]

    def test_parent_cannot_create_a_child(self, api_client, parent):
        api_client.force_authenticate(parent)

        response = api_client.post(
            LIST_URL,
            {"first_name": "X", "last_name": "Y", "date_of_birth": "2024-01-01"},
        )

        assert response.status_code == 403
        assert Child.objects.count() == 0

    def test_parent_cannot_update_their_own_child(
        self, api_client, parent, make_child, link_parent_to_child
    ):
        """Reading is allowed; editing the record is staff work."""
        child = make_child()
        link_parent_to_child(parent, child)
        api_client.force_authenticate(parent)

        response = api_client.patch(detail_url(child), {"first_name": "Changed"})

        assert response.status_code == 403

    def test_parent_cannot_archive(
        self, api_client, parent, make_child, link_parent_to_child
    ):
        child = make_child()
        link_parent_to_child(parent, child)
        api_client.force_authenticate(parent)

        response = api_client.post(reverse("child-archive", args=[child.id]))

        assert response.status_code == 403

    def test_parent_cannot_generate_an_access_code(
        self, api_client, parent, make_child, link_parent_to_child
    ):
        """Otherwise a parent could mint codes granting access to their child."""
        child = make_child()
        link_parent_to_child(parent, child)
        api_client.force_authenticate(parent)

        response = api_client.post(reverse("child-access-code", args=[child.id]))

        assert response.status_code == 403

    def test_revoked_guardianship_removes_api_access(
        self, api_client, parent, make_child, link_parent_to_child
    ):
        child = make_child()
        link = link_parent_to_child(parent, child)
        api_client.force_authenticate(parent)
        assert api_client.get(detail_url(child)).status_code == 200

        link.revoke()

        assert api_client.get(detail_url(child)).status_code == 404

    def test_anonymous_access_is_rejected(self, api_client, make_child):
        child = make_child()
        assert api_client.get(LIST_URL).status_code == 401
        assert api_client.get(detail_url(child)).status_code == 401


@pytest.mark.django_db
class TestFieldVisibility:
    def test_parent_does_not_receive_staff_only_notes(
        self, api_client, parent, make_child, link_parent_to_child
    ):
        child = make_child()
        child.medical_notes = "Traitement confidentiel"
        child.notes = "Note interne"
        child.save()
        link_parent_to_child(parent, child)
        api_client.force_authenticate(parent)

        response = api_client.get(detail_url(child))

        assert "medical_notes" not in response.data
        assert "notes" not in response.data
        # Allergies are safety information the family must have.
        assert "allergies" in response.data

    def test_staff_receive_the_full_record(self, api_client, staff, make_child):
        api_client.force_authenticate(staff)

        response = api_client.get(detail_url(make_child()))

        assert "medical_notes" in response.data
        assert "notes" in response.data


@pytest.mark.django_db
class TestChildCrud:
    def test_staff_can_create(self, api_client, staff):
        api_client.force_authenticate(staff)

        response = api_client.post(
            LIST_URL,
            {
                "first_name": "Mohamed",
                "last_name": "Benali",
                "date_of_birth": "2024-03-15",
                "gender": "M",
            },
        )

        assert response.status_code == 201
        assert Child.objects.count() == 1

    def test_creation_is_audited(self, api_client, staff):
        api_client.force_authenticate(staff)
        api_client.post(
            LIST_URL,
            {"first_name": "A", "last_name": "B", "date_of_birth": "2024-03-15"},
        )

        assert AuditLog.objects.filter(action=AuditAction.CHILD_CREATED).exists()

    def test_future_birth_date_is_rejected(self, api_client, staff):
        api_client.force_authenticate(staff)
        tomorrow = date.today() + timedelta(days=1)

        response = api_client.post(
            LIST_URL,
            {"first_name": "A", "last_name": "B", "date_of_birth": tomorrow.isoformat()},
        )

        assert response.status_code == 400
        assert "date_of_birth" in response.data["error"]["details"]

    def test_blank_name_is_rejected(self, api_client, staff):
        api_client.force_authenticate(staff)

        response = api_client.post(
            LIST_URL,
            {"first_name": "   ", "last_name": "B", "date_of_birth": "2024-03-15"},
        )

        assert response.status_code == 400

    def test_staff_can_update(self, api_client, staff, make_child):
        child = make_child()
        api_client.force_authenticate(staff)

        response = api_client.patch(detail_url(child), {"allergies": "Arachides"})

        assert response.status_code == 200
        child.refresh_from_db()
        assert child.allergies == "Arachides"

    def test_computed_age_fields_are_returned(self, api_client, staff, make_child):
        child = make_child(date_of_birth=date.today() - relativedelta(months=29))
        api_client.force_authenticate(staff)

        response = api_client.get(detail_url(child))

        assert response.data["age_months"] == 29
        assert response.data["age_group"]["key"] == "PRESCHOOL"
        assert response.data["age_group"]["label"] == "2 ans et +"

    def test_age_is_not_writable(self, api_client, staff, make_child):
        """Age is derived; accepting it would let the two disagree."""
        child = make_child()
        api_client.force_authenticate(staff)

        response = api_client.patch(detail_url(child), {"age_months": 999})

        assert response.status_code == 200
        assert response.data["age_months"] != 999


@pytest.mark.django_db
class TestArchiveRestore:
    def test_staff_can_archive(self, api_client, staff, make_child):
        child = make_child()
        api_client.force_authenticate(staff)

        response = api_client.post(reverse("child-archive", args=[child.id]))

        assert response.status_code == 200
        child.refresh_from_db()
        assert child.is_archived

    def test_archived_child_leaves_the_default_list(
        self, api_client, staff, make_child
    ):
        child = make_child()
        api_client.force_authenticate(staff)
        api_client.post(reverse("child-archive", args=[child.id]))

        response = api_client.get(LIST_URL)

        assert response.data["count"] == 0

    def test_staff_can_list_archived_explicitly(self, api_client, staff, make_child):
        child = make_child()
        api_client.force_authenticate(staff)
        api_client.post(reverse("child-archive", args=[child.id]))

        response = api_client.get(LIST_URL, {"status": "ARCHIVED"})

        assert response.data["count"] == 1

    def test_archiving_twice_is_a_conflict(self, api_client, staff, make_child):
        child = make_child()
        api_client.force_authenticate(staff)
        api_client.post(reverse("child-archive", args=[child.id]))

        response = api_client.post(reverse("child-archive", args=[child.id]))

        assert response.status_code == 409

    def test_staff_cannot_restore(self, api_client, staff, admin, make_child):
        """Restore is deliberately admin-only."""
        child = make_child()
        child.archive(by=admin)
        api_client.force_authenticate(staff)

        response = api_client.post(reverse("child-restore", args=[child.id]))

        assert response.status_code == 403

    def test_admin_can_restore(self, api_client, admin, make_child):
        child = make_child()
        child.archive(by=admin)
        api_client.force_authenticate(admin)

        response = api_client.post(reverse("child-restore", args=[child.id]))

        assert response.status_code == 200
        child.refresh_from_db()
        assert not child.is_archived

    def test_staff_cannot_hard_delete(self, api_client, staff, make_child):
        child = make_child()
        api_client.force_authenticate(staff)

        response = api_client.delete(detail_url(child))

        assert response.status_code == 403
        assert Child.all_objects.count() == 1

    def test_admin_hard_delete_is_audited(self, api_client, admin, make_child):
        child = make_child()
        api_client.force_authenticate(admin)

        response = api_client.delete(detail_url(child))

        assert response.status_code == 204
        assert Child.all_objects.count() == 0
        assert AuditLog.objects.filter(action=AuditAction.CHILD_DELETED).exists()


@pytest.mark.django_db
class TestFilteringAndSearch:
    @pytest.fixture
    def cohort(self, make_child):
        today = date.today()
        return {
            "infant": make_child(
                first_name="Bébé", last_name="Un",
                date_of_birth=today - relativedelta(months=3),
            ),
            "baby": make_child(
                first_name="Petit", last_name="Deux",
                date_of_birth=today - relativedelta(months=9),
            ),
            "toddler": make_child(
                first_name="Moyen", last_name="Trois",
                date_of_birth=today - relativedelta(months=18),
            ),
            "preschool": make_child(
                first_name="Grand", last_name="Quatre",
                date_of_birth=today - relativedelta(months=36),
            ),
        }

    @pytest.mark.parametrize(
        ("group", "expected"),
        [
            ("INFANT", "Bébé"),
            ("BABY", "Petit"),
            ("TODDLER", "Moyen"),
            ("PRESCHOOL", "Grand"),
        ],
    )
    def test_age_group_filter(self, api_client, staff, cohort, group, expected):
        api_client.force_authenticate(staff)

        response = api_client.get(LIST_URL, {"age_group": group})

        assert [r["first_name"] for r in response.data["results"]] == [expected]

    def test_unknown_age_group_returns_empty(self, api_client, staff, cohort):
        api_client.force_authenticate(staff)

        response = api_client.get(LIST_URL, {"age_group": "NOT_A_GROUP"})

        assert response.data["count"] == 0

    def test_search_matches_first_or_last_name(self, api_client, staff, cohort):
        api_client.force_authenticate(staff)

        assert api_client.get(LIST_URL, {"search": "Moyen"}).data["count"] == 1
        assert api_client.get(LIST_URL, {"search": "Quatre"}).data["count"] == 1

    def test_search_matches_full_name(self, api_client, staff, cohort):
        api_client.force_authenticate(staff)

        response = api_client.get(LIST_URL, {"search": "Grand Quatre"})

        assert response.data["count"] == 1

    def test_search_is_case_insensitive(self, api_client, staff, cohort):
        api_client.force_authenticate(staff)

        assert api_client.get(LIST_URL, {"search": "grand"}).data["count"] == 1

    def test_ordering_by_birth_date(self, api_client, staff, cohort):
        api_client.force_authenticate(staff)

        response = api_client.get(LIST_URL, {"ordering": "date_of_birth"})

        names = [r["first_name"] for r in response.data["results"]]
        assert names == ["Grand", "Moyen", "Petit", "Bébé"]

    def test_pagination_metadata(self, api_client, staff, cohort):
        api_client.force_authenticate(staff)

        response = api_client.get(LIST_URL, {"page_size": 2})

        assert response.data["count"] == 4
        assert response.data["total_pages"] == 2
        assert len(response.data["results"]) == 2


@pytest.mark.django_db
class TestAgeGroupsEndpoint:
    def test_returns_all_groups_with_counts(self, api_client, staff, make_child):
        today = date.today()
        make_child(date_of_birth=today - relativedelta(months=3))
        make_child(date_of_birth=today - relativedelta(months=4))
        make_child(date_of_birth=today - relativedelta(months=30))
        api_client.force_authenticate(staff)

        response = api_client.get(reverse("age-group-list"))

        counts = {row["key"]: row["count"] for row in response.data}
        assert counts == {"INFANT": 2, "BABY": 0, "TODDLER": 0, "PRESCHOOL": 1}

    def test_labels_are_french(self, api_client, staff):
        api_client.force_authenticate(staff)

        response = api_client.get(reverse("age-group-list"))

        labels = {row["key"]: row["label"] for row in response.data}
        assert labels["TODDLER"] == "1 → 2 ans"

    def test_parent_counts_only_their_own_children(
        self, api_client, parent, other_parent, make_child, link_parent_to_child
    ):
        today = date.today()
        link_parent_to_child(
            parent, make_child(date_of_birth=today - relativedelta(months=3))
        )
        link_parent_to_child(
            other_parent, make_child(date_of_birth=today - relativedelta(months=3))
        )
        api_client.force_authenticate(parent)

        response = api_client.get(reverse("age-group-list"))

        counts = {row["key"]: row["count"] for row in response.data}
        assert counts["INFANT"] == 1


@pytest.mark.django_db
class TestGuardiansAndCodes:
    def test_staff_can_link_an_existing_parent(
        self, api_client, staff, parent, make_child
    ):
        child = make_child()
        api_client.force_authenticate(staff)

        response = api_client.post(
            reverse("child-guardians", args=[child.id]),
            {"email": parent.email, "relationship": "MOTHER", "is_primary": True},
        )

        assert response.status_code == 201
        assert Child.objects.visible_to(parent).count() == 1

    def test_linking_an_unknown_email_is_rejected(self, api_client, staff, make_child):
        api_client.force_authenticate(staff)

        response = api_client.post(
            reverse("child-guardians", args=[make_child().id]),
            {"email": "nobody@example.com", "relationship": "MOTHER"},
        )

        assert response.status_code == 400

    def test_a_staff_account_cannot_be_linked_as_a_guardian(
        self, api_client, staff, make_child
    ):
        api_client.force_authenticate(staff)

        response = api_client.post(
            reverse("child-guardians", args=[make_child().id]),
            {"email": staff.email, "relationship": "MOTHER"},
        )

        assert response.status_code == 400

    def test_promoting_a_new_primary_demotes_the_previous_one(
        self, api_client, staff, parent, other_parent, make_child,
        link_parent_to_child,
    ):
        """The partial unique index allows only one primary guardian."""
        child = make_child()
        first = link_parent_to_child(parent, child, is_primary=True)
        api_client.force_authenticate(staff)

        api_client.post(
            reverse("child-guardians", args=[child.id]),
            {"email": other_parent.email, "relationship": "FATHER", "is_primary": True},
        )

        first.refresh_from_db()
        assert first.is_primary is False
        assert Guardianship.objects.filter(
            child=child, is_primary=True, revoked_at__isnull=True
        ).count() == 1

    def test_access_code_is_returned_once_in_plaintext(
        self, api_client, staff, make_child
    ):
        child = make_child()
        api_client.force_authenticate(staff)

        response = api_client.post(reverse("child-access-code", args=[child.id]))

        assert response.status_code == 201
        assert response.data["code"].startswith("MAM-")
        assert AuditLog.objects.filter(action=AuditAction.CODE_ISSUED).exists()

    def test_regenerating_invalidates_the_previous_code(
        self, api_client, staff, make_child
    ):
        from apps.accounts.access_codes import ChildAccessCode

        child = make_child()
        api_client.force_authenticate(staff)
        first = api_client.post(
            reverse("child-access-code", args=[child.id])
        ).data["code"]

        api_client.post(reverse("child-access-code", args=[child.id]))

        assert ChildAccessCode.resolve(first) is None

    def test_revoking_disables_the_code(self, api_client, staff, make_child):
        from apps.accounts.access_codes import ChildAccessCode

        child = make_child()
        api_client.force_authenticate(staff)
        code = api_client.post(
            reverse("child-access-code", args=[child.id])
        ).data["code"]

        response = api_client.delete(reverse("child-access-code", args=[child.id]))

        assert response.status_code == 204
        assert ChildAccessCode.resolve(code) is None

    def test_revoking_a_guardian_removes_access(
        self, api_client, staff, parent, make_child, link_parent_to_child
    ):
        child = make_child()
        link = link_parent_to_child(parent, child)
        api_client.force_authenticate(staff)

        response = api_client.delete(
            reverse("child-revoke-guardian", args=[child.id, link.id])
        )

        assert response.status_code == 204
        assert Child.objects.visible_to(parent).count() == 0
