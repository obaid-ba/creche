"""Access-code security properties (docs/authentication.md 4).

The code is the parent's standing credential, not a one-shot enrolment
ticket, so these cover the properties that matters for a credential:
size, that using it does not spend it, and that guessing at it is
expensive.
"""
import pytest
from django.test import override_settings
from django.utils import timezone

from apps.accounts.access_codes import (
    CODE_ALPHABET,
    CODE_LENGTH,
    ChildAccessCode,
    code_lookup_hash,
    fold_name,
    generate_plain_code,
    normalise_code,
)


class TestGeneration:
    def test_format(self):
        code = generate_plain_code()
        prefix, *groups = code.split("-")
        assert prefix == "MAM"
        assert "".join(groups) and len("".join(groups)) == CODE_LENGTH
        # Printed in fours: a twelve-character run is where transcription
        # errors come from.
        assert all(len(g) == 4 for g in groups)

    def test_is_long_enough_to_be_a_credential(self):
        """~40 bits. The old 5-character code was ~25, which was right for
        something used once and far too thin for a standing login."""
        entropy = CODE_LENGTH * (len(CODE_ALPHABET) ** 0.5) ** 0  # keep it explicit
        del entropy
        import math

        bits = CODE_LENGTH * math.log2(len(CODE_ALPHABET))
        assert bits > 38, f"only {bits:.1f} bits of entropy"

    def test_excludes_ambiguous_glyphs(self):
        """0/O and 1/I/L are absent: parents type these off paper."""
        for char in "01OIL":
            assert char not in CODE_ALPHABET

        for _ in range(200):
            body = generate_plain_code().replace("MAM-", "")
            assert not set(body) & set("01OIL")

    def test_codes_are_not_repeated(self):
        codes = {generate_plain_code() for _ in range(500)}
        assert len(codes) == 500


class TestNormalisation:
    @pytest.mark.parametrize(
        "typed",
        [
            "MAM-7F42-K9QX", "mam-7f42-k9qx", "MAM 7F42 K9QX",
            " mam7f42k9qx ", "7F42K9QX", "7f42-k9qx",
        ],
    )
    def test_accepts_what_a_human_types(self, typed):
        assert normalise_code(typed) == "MAM-7F42K9QX"

    def test_lookup_hash_is_stable_across_input_forms(self):
        assert code_lookup_hash("mam 7f42 k9qx") == code_lookup_hash("MAM-7F42-K9QX")

    def test_different_codes_hash_differently(self):
        assert code_lookup_hash("MAM-7F42-K9QX") != code_lookup_hash("MAM-7F42-K9QY")


class TestNameFolding:
    """A parent on a phone keyboard should not be locked out over an accent."""

    @pytest.mark.parametrize(
        ("typed", "stored"),
        [("mohamed", "Mohamed"), ("ines", "Inès"), ("  sofia ", "Sofia"),
         ("AMÉLIE", "Amelie")],
    )
    def test_matches_despite_case_accents_and_spacing(self, typed, stored):
        assert fold_name(typed) == fold_name(stored)

    def test_still_distinguishes_different_names(self):
        assert fold_name("Yasmine") != fold_name("Yasmin")


@pytest.mark.django_db
class TestIssueAndResolve:
    def test_plaintext_is_never_stored(self, make_child, staff, parent):
        child = make_child()
        instance, plain = ChildAccessCode.issue(
            child=child, parent=parent.parent_profile, issued_by=staff
        )

        body = plain.replace("MAM-", "")
        assert instance.code_lookup != plain
        assert body not in instance.code_lookup
        # The hint reveals only the first two body characters.
        assert instance.code_hint == f"{plain[:6]}…"

    def test_resolve_finds_a_live_code(self, make_child, parent):
        child = make_child()
        _, plain = ChildAccessCode.issue(child=child, parent=parent.parent_profile)

        resolved = ChildAccessCode.resolve(plain)
        assert resolved is not None
        assert resolved.child_id == child.id

    def test_resolve_is_case_and_format_insensitive(self, make_child, parent):
        _, plain = ChildAccessCode.issue(
            child=make_child(), parent=parent.parent_profile
        )
        assert ChildAccessCode.resolve(plain.lower().replace("-", " ")) is not None

    def test_unknown_code_resolves_to_none(self, db):
        assert ChildAccessCode.resolve("MAM-ZZZZ-ZZZZ") is None

    def test_using_a_code_does_not_spend_it(self, make_child, parent):
        """The whole point of the change: it is a key, not a ticket."""
        _, plain = ChildAccessCode.issue(
            child=make_child(), parent=parent.parent_profile
        )
        ChildAccessCode.resolve(plain).register_success()

        assert ChildAccessCode.resolve(plain) is not None

    def test_revoked_code_is_rejected(self, make_child, parent):
        _, plain = ChildAccessCode.issue(
            child=make_child(), parent=parent.parent_profile
        )
        ChildAccessCode.resolve(plain).revoke()

        assert ChildAccessCode.resolve(plain) is None

    def test_reissuing_revokes_the_previous_code(self, make_child, parent):
        """One live code per guardian - reissuing invalidates the old."""
        child = make_child()
        profile = parent.parent_profile
        _, first = ChildAccessCode.issue(child=child, parent=profile)
        _, second = ChildAccessCode.issue(child=child, parent=profile)

        assert ChildAccessCode.resolve(first) is None
        assert ChildAccessCode.resolve(second) is not None

    def test_each_guardian_gets_their_own(self, make_child, parent, other_parent):
        """A mother and a father hold separate codes, so one can be
        revoked without locking the other out."""
        child = make_child()
        _, mother = ChildAccessCode.issue(child=child, parent=parent.parent_profile)
        _, father = ChildAccessCode.issue(
            child=child, parent=other_parent.parent_profile
        )

        assert ChildAccessCode.resolve(mother) is not None
        assert ChildAccessCode.resolve(father) is not None
        assert ChildAccessCode.objects.usable().filter(child=child).count() == 2


@pytest.mark.django_db
class TestLockout:
    """Throttling by IP alone does nothing against an attacker with many
    addresses, so the code locks itself."""

    @override_settings(ACCESS_CODE_MAX_ATTEMPTS=3, ACCESS_CODE_LOCKOUT_MINUTES=60)
    def test_locks_after_repeated_failures(self, make_child, parent):
        _, plain = ChildAccessCode.issue(
            child=make_child(), parent=parent.parent_profile
        )

        for _ in range(3):
            ChildAccessCode.resolve(plain).register_failure()

        assert ChildAccessCode.resolve(plain) is None

    @override_settings(ACCESS_CODE_MAX_ATTEMPTS=3)
    def test_a_success_clears_the_count(self, make_child, parent):
        _, plain = ChildAccessCode.issue(
            child=make_child(), parent=parent.parent_profile
        )

        ChildAccessCode.resolve(plain).register_failure()
        ChildAccessCode.resolve(plain).register_failure()
        ChildAccessCode.resolve(plain).register_success()
        ChildAccessCode.resolve(plain).register_failure()

        assert ChildAccessCode.resolve(plain) is not None

    def test_the_lock_expires(self, make_child, parent):
        from datetime import timedelta

        _, plain = ChildAccessCode.issue(
            child=make_child(), parent=parent.parent_profile
        )
        instance = ChildAccessCode.resolve(plain)
        instance.locked_until = timezone.now() - timedelta(seconds=1)
        instance.save(update_fields=["locked_until"])

        assert ChildAccessCode.resolve(plain) is not None
