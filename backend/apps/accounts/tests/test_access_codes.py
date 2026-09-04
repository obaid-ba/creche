"""Access-code security properties (docs/authentication.md 4)."""
import pytest
from django.utils import timezone

from apps.accounts.access_codes import (
    CODE_ALPHABET,
    ChildAccessCode,
    code_lookup_hash,
    generate_plain_code,
    normalise_code,
)


class TestGeneration:
    def test_format(self):
        code = generate_plain_code()
        prefix, body = code.split("-")
        assert prefix == "MAM"
        assert len(body) == 5

    def test_excludes_ambiguous_glyphs(self):
        """0/O and 1/I/L are absent: parents type these off paper."""
        for char in "01OIL":
            assert char not in CODE_ALPHABET

        for _ in range(200):
            body = generate_plain_code().split("-")[1]
            assert not set(body) & set("01OIL")

    def test_codes_are_not_repeated(self):
        codes = {generate_plain_code() for _ in range(500)}
        assert len(codes) > 490  # collisions should be vanishingly rare


class TestNormalisation:
    @pytest.mark.parametrize(
        "typed",
        ["MAM-7F42K", "mam-7f42k", "MAM 7F42K", " mam7f42k ", "7F42K", "7f42k"],
    )
    def test_accepts_what_a_human_types(self, typed):
        assert normalise_code(typed) == "MAM-7F42K"

    def test_lookup_hash_is_stable_across_input_forms(self):
        assert code_lookup_hash("mam 7f42k") == code_lookup_hash("MAM-7F42K")

    def test_different_codes_hash_differently(self):
        assert code_lookup_hash("MAM-7F42K") != code_lookup_hash("MAM-7F42L")


@pytest.mark.django_db
class TestIssueAndResolve:
    def test_plaintext_is_never_stored(self, make_child, staff):
        child = make_child()
        instance, plain = ChildAccessCode.issue(child=child, issued_by=staff)

        body = plain.split("-")[1]
        assert instance.code_lookup != plain
        assert body not in instance.code_lookup
        # The hint reveals only the first two body characters.
        assert instance.code_hint == f"{plain[:6]}…"

    def test_resolve_finds_a_live_code(self, make_child):
        child = make_child()
        _, plain = ChildAccessCode.issue(child=child)

        resolved = ChildAccessCode.resolve(plain)
        assert resolved is not None
        assert resolved.child_id == child.id

    def test_resolve_is_case_and_format_insensitive(self, make_child):
        _, plain = ChildAccessCode.issue(child=make_child())
        assert ChildAccessCode.resolve(plain.lower().replace("-", " ")) is not None

    def test_unknown_code_resolves_to_none(self, db):
        assert ChildAccessCode.resolve("MAM-ZZZZZ") is None

    def test_claimed_code_cannot_be_reused(self, make_child, parent):
        _, plain = ChildAccessCode.issue(child=make_child())
        instance = ChildAccessCode.resolve(plain)
        instance.claimed_at = timezone.now()
        instance.claimed_by = parent.parent_profile
        instance.save()

        assert ChildAccessCode.resolve(plain) is None

    def test_revoked_code_is_rejected(self, make_child):
        _, plain = ChildAccessCode.issue(child=make_child())
        ChildAccessCode.resolve(plain).revoke()

        assert ChildAccessCode.resolve(plain) is None

    def test_expired_code_is_rejected(self, make_child):
        from datetime import timedelta

        _, plain = ChildAccessCode.issue(child=make_child())
        instance = ChildAccessCode.resolve(plain)
        instance.expires_at = timezone.now() - timedelta(seconds=1)
        instance.save()

        assert ChildAccessCode.resolve(plain) is None

    def test_reissuing_revokes_the_previous_code(self, make_child):
        """Only one live code per child - regenerating invalidates the old."""
        child = make_child()
        _, first = ChildAccessCode.issue(child=child)
        _, second = ChildAccessCode.issue(child=child)

        assert ChildAccessCode.resolve(first) is None
        assert ChildAccessCode.resolve(second) is not None

    def test_only_one_live_code_per_child(self, make_child):
        child = make_child()
        ChildAccessCode.issue(child=child)
        ChildAccessCode.issue(child=child)

        assert ChildAccessCode.objects.usable().filter(child=child).count() == 1
