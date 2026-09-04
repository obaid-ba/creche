"""Daily summary — computed from the event log, never stored.

This is what makes ``DailyRecord`` a read model rather than a second copy
of the care data: the "situation de l'enfant" screen and the timeline are
two shapes over the same rows, so they cannot disagree
(docs/timeline.md 3.1).

The aggregation runs in Python over one already-fetched day of events
rather than as several database aggregates. A child's day is on the order
of ten to thirty events, so a single indexed fetch plus a pass in memory
is both faster and far simpler than six round-trips — and the caller
usually needs the events anyway.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Iterable

from .event_types import TimelineEventType

MOOD_LABELS = {
    "HAPPY": "Joyeux",
    "CALM": "Calme",
    "TIRED": "Fatigué",
    "SAD": "Triste",
    "IRRITATED": "Irrité",
    "ACTIVE": "Actif",
    "OTHER": "Autre",
}

MEAL_LABELS = {
    "BREAKFAST": "Petit déjeuner",
    "LUNCH": "Déjeuner",
    "SNACK": "Goûter",
    "DINNER": "Dîner",
}

EATEN_LABELS = {
    "ALL": "Tout mangé",
    "MOST": "Presque tout",
    "SOME": "Un peu",
    "NONE": "Rien",
}


def _as_int(value) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def build_summary(events: Iterable) -> dict:
    """Aggregate one child-day of events into the parent-facing summary."""
    events = list(events)

    meals: list[dict] = []
    bottles = 0
    total_ml = 0

    naps = 0
    total_sleep_minutes = 0
    open_sleep = False

    temperatures: list[dict] = []
    moods: list[dict] = []

    diaper_changes = 0
    toilet_visits = 0
    toilet_successes = 0

    notes = 0

    for event in events:
        data = event.data or {}

        if event.type == TimelineEventType.MEAL:
            meals.append(
                {
                    "meal": data.get("meal"),
                    "label": MEAL_LABELS.get(data.get("meal", ""), "Repas"),
                    "eaten": data.get("eaten"),
                    "eaten_label": EATEN_LABELS.get(data.get("eaten", "")),
                    "occurred_at": event.occurred_at,
                }
            )

        elif event.type == TimelineEventType.BOTTLE:
            bottles += 1
            total_ml += _as_int(data.get("volume_ml"))

        elif event.type == TimelineEventType.SLEEP:
            naps += 1
            duration = event.duration_minutes
            if duration is None:
                # A nap in progress contributes to the count but not the
                # total, which would otherwise creep upward on every read.
                open_sleep = True
            else:
                total_sleep_minutes += duration

        elif event.type == TimelineEventType.TEMPERATURE:
            celsius = data.get("celsius")
            temperatures.append(
                {
                    "celsius": Decimal(str(celsius)) if celsius is not None else None,
                    "occurred_at": event.occurred_at,
                }
            )

        elif event.type == TimelineEventType.MOOD:
            mood = data.get("mood")
            moods.append(
                {
                    "mood": mood,
                    "label": MOOD_LABELS.get(mood or "", "Autre"),
                    "occurred_at": event.occurred_at,
                }
            )

        elif event.type == TimelineEventType.DIAPER:
            diaper_changes += 1

        elif event.type == TimelineEventType.TOILET:
            toilet_visits += 1
            if data.get("success"):
                toilet_successes += 1

        elif event.type == TimelineEventType.NOTE:
            notes += 1

    # Events arrive ordered by occurred_at, so "latest" is simply the last.
    last_temperature = temperatures[-1] if temperatures else None
    latest_mood = moods[-1] if moods else None

    return {
        "feeding": {
            "meals": len(meals),
            "bottles": bottles,
            "total_ml": total_ml,
            "details": meals,
        },
        "sleep": {
            "naps": naps,
            "total_minutes": total_sleep_minutes,
            "total_display": format_duration(total_sleep_minutes),
            "in_progress": open_sleep,
        },
        "health": {
            "temperature_count": len(temperatures),
            "last_temperature": (
                last_temperature["celsius"] if last_temperature else None
            ),
            "last_temperature_at": (
                last_temperature["occurred_at"] if last_temperature else None
            ),
        },
        "hygiene": {
            "diaper_changes": diaper_changes,
            "toilet_visits": toilet_visits,
            "toilet_successes": toilet_successes,
        },
        "mood": {
            "observations": len(moods),
            "latest": latest_mood["mood"] if latest_mood else None,
            "latest_label": latest_mood["label"] if latest_mood else None,
        },
        "notes": notes,
        "event_count": len(events),
    }


def format_duration(minutes: int) -> str:
    """Human-readable French duration: 75 -> "1h15"."""
    if minutes <= 0:
        return "0 min"
    hours, remainder = divmod(minutes, 60)
    if hours == 0:
        return f"{remainder} min"
    if remainder == 0:
        return f"{hours}h"
    return f"{hours}h{remainder:02d}"
