"""Test settings: fast, deterministic, isolated."""
from .base import *  # noqa: F401,F403

DEBUG = False

# MD5 hashing is ~100x faster than Argon2 and tests do not need the strength.
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

DATABASES["default"]["NAME"] = "test_creche_mamati"  # noqa: F405

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
