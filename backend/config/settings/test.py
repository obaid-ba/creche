"""Test settings: fast, deterministic, isolated."""
from .base import *  # noqa: F401,F403
from .base import env

DEBUG = False

# MD5 hashing is ~100x faster than Argon2 and tests do not need the strength.
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# ── Database ────────────────────────────────────────────────────────────
# Rebuilt from scratch, deliberately ignoring DATABASE_URL.
#
# base.py prefers DATABASE_URL when it is set, which is right for a
# managed host and catastrophic here: with Supabase credentials in .env,
# `pytest` connected to the production project and created, migrated and
# dropped `test_test_creche_mamati` on it. The symptoms were an eight
# minute suite and runs that errored at random in whichever test happened
# to hold the connection when the pooler dropped it.
#
# So tests take the discrete local settings only. TEST_POSTGRES_* wins
# where it is set, which is how a run inside the compose network points at
# the `db` service; otherwise it is loopback, never whatever POSTGRES_HOST
# happens to say, because that is `db` in the compose .env and does not
# resolve from the host.
DATABASES = {  # noqa: F405
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "test_creche_mamati",
        "USER": env("TEST_POSTGRES_USER", default=env("POSTGRES_USER", default="creche")),  # noqa: F405
        "PASSWORD": env(  # noqa: F405
            "TEST_POSTGRES_PASSWORD",
            default=env("POSTGRES_PASSWORD", default="creche_dev_password"),  # noqa: F405
        ),
        "HOST": env("TEST_POSTGRES_HOST", default="127.0.0.1"),  # noqa: F405
        "PORT": env.int("TEST_POSTGRES_PORT", default=5432),  # noqa: F405
        "CONN_MAX_AGE": 0,
        "DISABLE_SERVER_SIDE_CURSORS": False,
    }
}

# Throttling would make tests order-dependent and flaky; individual throttle
# tests re-enable it explicitly via override_settings.
REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {  # noqa: F405
    "login": None,
    "code_login": None,
    "contact": None,
    "user": None,
}

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

ACCESS_CODE_HMAC_KEY = "test-hmac-key-deterministic"

# Uploads go to a throwaway directory so a test run never leaves files in
# the working tree (and cannot collide with a dev server's media/).
import tempfile

MEDIA_ROOT = tempfile.mkdtemp(prefix="creche-test-media-")

import logging

logging.disable(logging.CRITICAL)
