from datetime import timedelta

import pytest
from django.utils import timezone

from apps.care.models import TimelineEvent


@pytest.fixture
def at_today():
    """Build a timezone-aware datetime at HH:MM on the local today."""
    def _at(hour: int, minute: int = 0):
        local_now = timezone.localtime()
        naive = local_now.replace(
            hour=hour, minute=minute, second=0, microsecond=0
        )
        return naive

    return _at


@pytest.fixture
def make_event(db, at_today):
    def _make(child, event_type="BOTTLE", hour=8, minute=0, data=None,
              created_by=None, published=True, ended_at=None, **extra):
        defaults = {
            "BOTTLE": {"volume_ml": 180},
            "MEAL": {"meal": "LUNCH", "eaten": "MOST"},
            "TEMPERATURE": {"celsius": "36.6"},
            "MOOD": {"mood": "HAPPY"},
            "DIAPER": {"state": "WET"},
            "TOILET": {"success": True},
            "SLEEP": {},
            "NOTE": {},
        }
        return TimelineEvent.objects.create(
            child=child,
            type=event_type,
            occurred_at=at_today(hour, minute),
            ended_at=ended_at,
            data=data if data is not None else defaults.get(event_type, {}),
            created_by=created_by,
            is_published=published,
            **extra,
        )

    return _make

