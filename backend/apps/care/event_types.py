"""Timeline event type registry — the extension point.

Adding a new event type means adding one entry here plus an icon/label in
the frontend map. No migration, no new table, no change to the timeline
query, the permission layer or the UI shell (docs/timeline.md 5).

Each type declares:

``label``      French text shown when the event has no explicit title
``icon``       lucide icon name the frontend resolves
``group``      filter chip it belongs to (docs/timeline.md 7)
``schema``     serializer validating the JSONB ``data`` payload
``interval``   whether ``ended_at`` is meaningful for this type
``reference``  the aggregate that owns the content, if any

Storage is permissive (JSONB) but validation is strict: an unknown key or
an out-of-range value is a 400, so the payload cannot silently rot.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time
from decimal import Decimal

from django.db import models
from django.utils.functional import Promise
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework.settings import api_settings


class TimelineEventType(models.TextChoices):
    # Owned: TimelineEvent *is* the record.
    MEAL = "MEAL", _("Repas")
    BOTTLE = "BOTTLE", _("Biberon")
    SLEEP = "SLEEP", _("Sommeil")
    DIAPER = "DIAPER", _("Change")
    TOILET = "TOILET", _("Toilettes")
    TEMPERATURE = "TEMPERATURE", _("Température")
    MOOD = "MOOD", _("Humeur")
    NOTE = "NOTE", _("Note")

    # Reference: another aggregate owns the content.
    ACTIVITY = "ACTIVITY", _("Activité")
    MESSAGE = "MESSAGE", _("Message")


class EventGroup(models.TextChoices):
    """Parent-facing filter chips (docs/timeline.md 7)."""

    MEALS = "meals", _("Repas")
    SLEEP = "sleep", _("Sommeil")
    ACTIVITIES = "activities", _("Activités")
    HEALTH = "health", _("Santé")
    HYGIENE = "hygiene", _("Hygiène")
    OTHER = "other", _("Autre")


# ── Payload schemas ─────────────────────────────────────────────────────
# `strict` rejects unknown keys rather than silently dropping them, so a
# typo in a client payload is reported instead of quietly losing data.


class StrictPayloadSerializer(serializers.Serializer):
    """Rejects unknown keys instead of silently dropping them.

    Errors raised from ``to_internal_value`` must carry a **dict** detail:
    a bare string makes DRF fail with a ValueError while building the
    error response, turning a 400 into a 500.
    """

    def to_internal_value(self, data):
        if not isinstance(data, dict):
            raise serializers.ValidationError(
                {
                    api_settings.NON_FIELD_ERRORS_KEY: [
                        "Les données de l'événement doivent être un objet."
                    ]
                }
            )
        unknown = set(data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError(
                {
                    key: ["Ce champ n'est pas attendu pour ce type d'événement."]
                    for key in sorted(unknown)
                }
            )
        return super().to_internal_value(data)


class EmptyPayload(StrictPayloadSerializer):
    pass


class MealPayload(StrictPayloadSerializer):
    MEAL_CHOICES = ["BREAKFAST", "LUNCH", "SNACK", "DINNER"]
    EATEN_CHOICES = ["ALL", "MOST", "SOME", "NONE"]

    meal = serializers.ChoiceField(choices=MEAL_CHOICES)
    eaten = serializers.ChoiceField(choices=EATEN_CHOICES, required=False)
    menu = serializers.CharField(max_length=200, required=False, allow_blank=True)


class BottlePayload(StrictPayloadSerializer):
    # A 500 ml ceiling catches a "1800" typo for 180 ml before it reaches
    # the parent's screen as an alarming number.
    volume_ml = serializers.IntegerField(min_value=0, max_value=500)
    formula = serializers.CharField(max_length=100, required=False, allow_blank=True)
    finished = serializers.BooleanField(required=False)


class SleepPayload(StrictPayloadSerializer):
    quality = serializers.ChoiceField(
        choices=["GOOD", "RESTLESS", "POOR"], required=False
    )


class DiaperPayload(StrictPayloadSerializer):
    state = serializers.ChoiceField(choices=["WET", "SOILED", "BOTH", "DRY"])
    cream = serializers.BooleanField(required=False)


class ToiletPayload(StrictPayloadSerializer):
    success = serializers.BooleanField()


class TemperaturePayload(StrictPayloadSerializer):
    # Bounded to plausible human body temperatures: a value outside this
    # range is a data-entry error, not a reading.
    celsius = serializers.DecimalField(
        max_digits=4,
        decimal_places=1,
        min_value=Decimal("30.0"),
        max_value=Decimal("45.0"),
    )
    method = serializers.ChoiceField(
        choices=["FOREHEAD", "EAR", "ARMPIT", "ORAL", "OTHER"], required=False
    )


class MoodPayload(StrictPayloadSerializer):
    MOOD_CHOICES = ["HAPPY", "CALM", "TIRED", "SAD", "IRRITATED", "ACTIVE", "OTHER"]

    mood = serializers.ChoiceField(choices=MOOD_CHOICES)
    note = serializers.CharField(max_length=200, required=False, allow_blank=True)


@dataclass(frozen=True)
class EventTypeSpec:
    key: str
    #: A lazy proxy, not a str: the registry is built once at import, but
    #: the language is only known per request. Call ``force_str`` at the
    #: serialisation boundary to resolve it.
    label: Promise | str
    icon: str
    group: str
    schema: type[serializers.Serializer]
    interval: bool = False
    reference: str | None = None
    #: Types staff record directly. Reference types are created as a side
    #: effect of their owning aggregate, never posted to the timeline API.
    staff_creatable: bool = True
    quick_add: bool = False


REGISTRY: dict[str, EventTypeSpec] = {
    spec.key: spec
    for spec in [
        EventTypeSpec(
            key=TimelineEventType.BOTTLE, label=_("Biberon"), icon="milk",
            group=EventGroup.MEALS, schema=BottlePayload, quick_add=True,
        ),
        EventTypeSpec(
            key=TimelineEventType.MEAL, label=_("Repas"), icon="utensils",
            group=EventGroup.MEALS, schema=MealPayload, quick_add=True,
        ),
        EventTypeSpec(
            key=TimelineEventType.SLEEP, label=_("Sommeil"), icon="moon",
            group=EventGroup.SLEEP, schema=SleepPayload,
            interval=True, quick_add=True,
        ),
        EventTypeSpec(
            key=TimelineEventType.DIAPER, label=_("Change"), icon="baby",
            group=EventGroup.HYGIENE, schema=DiaperPayload, quick_add=True,
        ),
        EventTypeSpec(
            key=TimelineEventType.TOILET, label=_("Toilettes"), icon="toilet",
            group=EventGroup.HYGIENE, schema=ToiletPayload, quick_add=True,
        ),
        EventTypeSpec(
            key=TimelineEventType.TEMPERATURE, label=_("Température"),
            icon="thermometer", group=EventGroup.HEALTH,
            schema=TemperaturePayload, quick_add=True,
        ),
        EventTypeSpec(
            key=TimelineEventType.MOOD, label=_("Humeur"), icon="smile",
            group=EventGroup.HEALTH, schema=MoodPayload, quick_add=True,
        ),
        EventTypeSpec(
            key=TimelineEventType.NOTE, label=_("Note"), icon="sticky-note",
            group=EventGroup.OTHER, schema=EmptyPayload,
        ),
        EventTypeSpec(
            key=TimelineEventType.ACTIVITY, label=_("Activité"), icon="palette",
            group=EventGroup.ACTIVITIES, schema=EmptyPayload,
            interval=True, reference="activity", staff_creatable=False,
        ),
        EventTypeSpec(
            key=TimelineEventType.MESSAGE, label=_("Message"),
            icon="message-circle", group=EventGroup.OTHER,
            schema=EmptyPayload, reference="message", staff_creatable=False,
        ),
    ]
}

#: The order chips are presented in, per the brief (11). Declared
#: explicitly rather than inherited from REGISTRY insertion order, so
#: adding a type cannot silently reshuffle the parent-facing filter bar.
CHIP_ORDER: list[str] = [
    EventGroup.MEALS,
    EventGroup.SLEEP,
    EventGroup.ACTIVITIES,
    EventGroup.HEALTH,
    EventGroup.HYGIENE,
    EventGroup.OTHER,
]

#: Filter chip -> the types it covers. Derived from the registry rather
#: than written twice, so a new type joins its chip automatically.
GROUP_TYPES: dict[str, list[str]] = {group: [] for group in CHIP_ORDER}
for _spec in REGISTRY.values():
    GROUP_TYPES.setdefault(_spec.group, []).append(_spec.key)


def spec_for(event_type: str) -> EventTypeSpec:
    try:
        return REGISTRY[event_type]
    except KeyError:
        raise serializers.ValidationError(
            {"type": f"Type d'événement inconnu : {event_type}."}
        ) from None


def _json_safe(value):
    """Coerce validated values into something JSONB can store.

    DRF returns rich Python objects — ``DecimalField`` yields a ``Decimal``,
    date fields yield ``date``/``datetime`` — none of which ``json.dumps``
    accepts. Without this, a valid temperature reading raises
    ``TypeError: Object of type Decimal is not JSON serializable`` at save
    time and surfaces as a 500. Decimals become strings rather than floats
    so 36.6 does not turn into 36.60000000000000142.
    """
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    return value


def validate_payload(event_type: str, data: dict | None) -> dict:
    """Validate ``data`` against the schema declared for ``event_type``."""
    schema = spec_for(event_type).schema
    serializer = schema(data=data or {})
    if not serializer.is_valid():
        raise serializers.ValidationError({"data": serializer.errors})
    return _json_safe(dict(serializer.validated_data))


def types_for_filter(name: str | None) -> list[str] | None:
    """Resolve a filter chip to its event types, or ``None`` for "all"."""
    if not name or name == "all":
        return None
    return GROUP_TYPES.get(name)


def registry_payload() -> list[dict]:
    """Serialisable registry, so the frontend never hardcodes the list."""
    return [
        {
            "key": spec.key,
            "label": spec.label,
            "icon": spec.icon,
            "group": spec.group,
            "interval": spec.interval,
            "staff_creatable": spec.staff_creatable,
            "quick_add": spec.quick_add,
        }
        for spec in REGISTRY.values()
    ]
