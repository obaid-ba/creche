"""Ownership scoping - the control that keeps families apart.

docs/authentication.md 5: a child id from the client is never used to
decide access, only to look within an already-restricted queryset.
"""
import pytest
from django.contrib.auth.models import AnonymousUser

from apps.children.models import Child


@pytest.mark.django_db
class TestVisibleTo:
    def test_parent_sees_only_their_own_child(
        self, parent, other_parent, make_child, link_parent_to_child
    ):
        mine = make_child(first_name="Mohamed")
        theirs = make_child(first_name="Yasmine")
        link_parent_to_child(parent, mine)
        link_parent_to_child(other_parent, theirs)

        visible = Child.objects.visible_to(parent)

        assert list(visible) == [mine]
        assert theirs not in visible

    def test_parent_with_no_children_sees_nothing(self, parent, make_child):
        make_child()
        assert Child.objects.visible_to(parent).count() == 0

    def test_revoked_guardianship_removes_access_immediately(
        self, parent, make_child, link_parent_to_child
    ):
        child = make_child()
        guardianship = link_parent_to_child(parent, child)
        assert Child.objects.visible_to(parent).count() == 1

        guardianship.revoke()

        assert Child.objects.visible_to(parent).count() == 0

    def test_staff_sees_every_child(self, staff, make_child):
        make_child(first_name="Mohamed")
        make_child(first_name="Yasmine")

        assert Child.objects.visible_to(staff).count() == 2

    def test_admin_sees_every_child(self, admin, make_child):
        make_child()
        assert Child.objects.visible_to(admin).count() == 1

    def test_anonymous_sees_nothing(self, make_child):
        make_child()
        assert Child.objects.visible_to(AnonymousUser()).count() == 0

    def test_two_parents_can_share_one_child(
        self, parent, other_parent, make_child, link_parent_to_child
    ):
        child = make_child()
        link_parent_to_child(parent, child)
        link_parent_to_child(other_parent, child)

        assert Child.objects.visible_to(parent).count() == 1
        assert Child.objects.visible_to(other_parent).count() == 1

    def test_parent_with_two_children_sees_each_once(
        self, parent, make_child, link_parent_to_child
    ):
        """distinct() must not let the join duplicate rows."""
        for name in ("Mohamed", "Yasmine"):
            link_parent_to_child(parent, make_child(first_name=name))

        assert Child.objects.visible_to(parent).count() == 2


@pytest.mark.django_db
class TestArchiving:
    def test_archived_child_is_hidden_from_default_manager(self, make_child, staff):
        child = make_child()
        child.archive(by=staff)

        assert Child.objects.count() == 0
        assert Child.all_objects.count() == 1

    def test_archive_sets_status_and_timestamp_together(self, make_child, staff):
        child = make_child()
        child.archive(by=staff)

        assert child.status == "ARCHIVED"
        assert child.archived_at is not None

    def test_restore_brings_the_child_back(self, make_child, staff):
        child = make_child()
        child.archive(by=staff)
        child.restore()

        assert Child.objects.count() == 1
        assert child.status == "ACTIVE"
        assert child.archived_at is None

    def test_archived_child_is_invisible_to_its_parent(
        self, parent, make_child, link_parent_to_child, staff
    ):
        child = make_child()
        link_parent_to_child(parent, child)
        child.archive(by=staff)

        assert Child.objects.visible_to(parent).count() == 0
