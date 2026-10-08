"""The test suite must never connect to a managed database.

``base.py`` prefers ``DATABASE_URL`` when it is set, which is correct for
Render and fatal here: once real Supabase credentials landed in ``.env``,
``pytest`` pointed at the production project and created, migrated and
dropped ``test_test_creche_mamati`` on it. Nothing failed loudly. What it
looked like instead was an eight-minute suite and a handful of tests
erroring at random in whichever one held the connection when the pooler
dropped it.

These assertions are cheap and need no database of their own.
"""
from django.conf import settings

# Hosts that mean "someone's real data is behind this".
MANAGED = ("supabase.co", "supabase.com", "pooler.supabase.com",
           "rds.amazonaws.com", "onrender.com", "neon.tech", "railway.app")

LOOPBACK = ("127.0.0.1", "localhost", "::1")


def test_the_host_is_not_a_managed_provider():
    host = settings.DATABASES["default"]["HOST"]
    assert not any(domain in host for domain in MANAGED), (
        f"tests are pointed at {host!r} - a managed database. Test settings "
        "must build the connection from TEST_POSTGRES_*/POSTGRES_*, never "
        "from DATABASE_URL."
    )


def test_the_host_is_local_unless_deliberately_overridden():
    """Loopback, or whatever TEST_POSTGRES_HOST says (compose uses `db`)."""
    import os

    host = settings.DATABASES["default"]["HOST"]
    if os.environ.get("TEST_POSTGRES_HOST"):
        return
    assert host in LOOPBACK, (
        f"tests default to {host!r}; expected loopback. Set TEST_POSTGRES_HOST "
        "if you really mean to reach another host."
    )


def test_the_database_name_is_the_throwaway_one():
    assert settings.DATABASES["default"]["NAME"] == "test_creche_mamati"


def test_the_hmac_key_is_the_deterministic_test_one():
    """A real key here would mean the suite is running on real settings."""
    assert settings.ACCESS_CODE_HMAC_KEY == "test-hmac-key-deterministic"
