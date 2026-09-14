"""Type registry and payload validation (docs/timeline.md 4.3)."""
import pytest
from rest_framework.exceptions import ValidationError

from apps.care.event_types import (
    GROUP_TYPES,
    REGISTRY,
    TimelineEventType,
    registry_payload,
    spec_for,
    types_for_filter,
    validate_payload,
)


class TestRegistry:
    def test_every_declared_type_has_a_spec(self):
        """A type without a spec would crash the serializer at read time."""
        for value in TimelineEventType.values:
            assert value in REGISTRY, f"{value} missing from REGISTRY"

    def test_unknown_type_is_a_validation_error_not_a_crash(self):
        with pytest.raises(ValidationError):
            spec_for("NOT_A_TYPE")

    def test_reference_types_are_not_staff_creatable(self):
        """An ACTIVITY row comes from its owning aggregate, never the API."""
        assert REGISTRY[TimelineEventType.ACTIVITY].staff_creatable is False

    def test_only_interval_types_are_marked_as_such(self):
        assert REGISTRY[TimelineEventType.SLEEP].interval is True
        assert REGISTRY[TimelineEventType.BOTTLE].interval is False

    def test_filter_groups_cover_every_type(self):
        grouped = {t for types in GROUP_TYPES.values() for t in types}
        assert grouped == set(TimelineEventType.values)

    def test_registry_payload_is_serialisable(self):
        payload = registry_payload()
        assert len(payload) == len(REGISTRY)
        assert {"key", "label", "icon", "group"} <= set(payload[0])


class TestFilterResolution:
    def test_all_and_empty_mean_no_filter(self):
        assert types_for_filter("all") is None
        assert types_for_filter(None) is None
        assert types_for_filter("") is None

    def test_meals_covers_meal_and_bottle(self):
        assert set(types_for_filter("meals")) == {"MEAL", "BOTTLE"}

    def test_hygiene_covers_diaper_and_toilet(self):
        assert set(types_for_filter("hygiene")) == {"DIAPER", "TOILET"}

    def test_health_covers_temperature_and_mood(self):
        assert set(types_for_filter("health")) == {"TEMPERATURE", "MOOD"}


class TestPayloadValidation:
    def test_valid_bottle(self):
        assert validate_payload("BOTTLE", {"volume_ml": 180})["volume_ml"] == 180

    def test_bottle_rejects_an_implausible_volume(self):
        """Catches a 1800-for-180 typo before it alarms a parent."""
        with pytest.raises(ValidationError):
            validate_payload("BOTTLE", {"volume_ml": 1800})

    def test_bottle_requires_volume(self):
        with pytest.raises(ValidationError):
            validate_payload("BOTTLE", {})

    def test_unknown_key_is_rejected(self):
        """A typo must be reported, not silently stored in the JSONB."""
        with pytest.raises(ValidationError):
            validate_payload("BOTTLE", {"volume_ml": 180, "volumeml": 200})

    def test_temperature_bounds(self):
        assert validate_payload("TEMPERATURE", {"celsius": "36.6"})
        with pytest.raises(ValidationError):
            validate_payload("TEMPERATURE", {"celsius": "12.0"})
        with pytest.raises(ValidationError):
            validate_payload("TEMPERATURE", {"celsius": "50.0"})

    def test_mood_choices_are_enforced(self):
        assert validate_payload("MOOD", {"mood": "HAPPY"})
        with pytest.raises(ValidationError):
            validate_payload("MOOD", {"mood": "ECSTATIC"})

    def test_meal_choices_are_enforced(self):
        assert validate_payload("MEAL", {"meal": "LUNCH", "eaten": "MOST"})
        with pytest.raises(ValidationError):
            validate_payload("MEAL", {"meal": "BRUNCH"})

    def test_diaper_state_is_required(self):
        assert validate_payload("DIAPER", {"state": "WET"})
        with pytest.raises(ValidationError):
            validate_payload("DIAPER", {})

    def test_note_accepts_an_empty_payload(self):
        assert validate_payload("NOTE", {}) == {}
        assert validate_payload("NOTE", None) == {}

    def test_payload_must_be_an_object(self):
        with pytest.raises(ValidationError):
            validate_payload("BOTTLE", ["not", "a", "dict"])


class TestExtensibility:
    def test_adding_a_type_needs_only_a_registry_entry(self):
        """The property docs/timeline.md 5 promises.

        Everything the timeline needs about a type - label, icon, filter
        chip, payload schema - comes from the registry, so nothing outside
        it has to change when a type is added.
        """
        for spec in REGISTRY.values():
            assert spec.label
            assert spec.icon
            assert spec.group in GROUP_TYPES
            assert spec.schema is not None


class TestChipOrder:
    """The parent-facing filter bar order is part of the spec (brief 11)."""

    def test_chips_follow_the_declared_order(self):
        from apps.care.event_types import CHIP_ORDER, GROUP_TYPES

        assert list(GROUP_TYPES) == CHIP_ORDER

    def test_activities_sits_between_sleep_and_health(self):
        from apps.care.event_types import GROUP_TYPES

        order = list(GROUP_TYPES)
        assert order.index("sleep") < order.index("activities") < order.index("health")

    def test_every_chip_still_has_its_types(self):
        from apps.care.event_types import GROUP_TYPES

        assert set(GROUP_TYPES["meals"]) == {"MEAL", "BOTTLE"}
        assert set(GROUP_TYPES["hygiene"]) == {"DIAPER", "TOILET"}
        assert GROUP_TYPES["activities"] == ["ACTIVITY"]
