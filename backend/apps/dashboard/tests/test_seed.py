"""The demo seeder must be safe to re-run and refuse production."""
import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.accounts.models import User
from apps.care.models import TimelineEvent
from apps.children.models import Child


@pytest.mark.django_db
def test_seeding_is_idempotent(settings):
    settings.DEBUG = True

    call_command("seed_demo", days=1, verbosity=0)
    first = (Child.objects.count(), User.objects.count(), TimelineEvent.objects.count())

    call_command("seed_demo", days=1, verbosity=0)
    second = (Child.objects.count(), User.objects.count(), TimelineEvent.objects.count())

    assert first == second, "re-running the seeder duplicated data"


@pytest.mark.django_db
def test_refuses_to_run_with_debug_off(settings):
    """It creates accounts with a published password."""
    settings.DEBUG = False

    with pytest.raises(CommandError, match="DEBUG=False"):
        call_command("seed_demo", verbosity=0)


@pytest.mark.django_db
def test_force_overrides_the_guard(settings):
    settings.DEBUG = False

    call_command("seed_demo", "--force", days=1, verbosity=0)

    assert Child.objects.count() > 0


@pytest.mark.django_db
def test_today_is_left_unpublished_so_the_flow_is_demonstrable(settings):
    from django.utils import timezone

    settings.DEBUG = True
    call_command("seed_demo", days=2, verbosity=0)

    today = timezone.localdate()
    assert TimelineEvent.objects.filter(
        local_date=today, is_published=False
    ).exists()
    assert TimelineEvent.objects.filter(
        local_date__lt=today, is_published=True
    ).exists()
