"""
Base settings shared by every environment.

Environment-specific modules (dev / prod / test) import from here and override
only what genuinely differs. Secrets are read from the environment, never
committed - see .env.example for the full list of keys.
"""
from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
environ.Env.read_env(BASE_DIR.parent / ".env")

# ── Core ────────────────────────────────────────────────────────────────
SECRET_KEY = env("DJANGO_SECRET_KEY", default="insecure-dev-key-change-me")
DEBUG = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

# ── Applications ────────────────────────────────────────────────────────
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
]

LOCAL_APPS = [
    "common",
    "apps.accounts",
    "apps.children",
    "apps.care",
    "apps.activities",
    "apps.messaging",
    "apps.complaints",
    "apps.notifications",
    "apps.audit",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ── Database ────────────────────────────────────────────────────────────
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB", default="creche_mamati"),
        "USER": env("POSTGRES_USER", default="creche"),
        "PASSWORD": env("POSTGRES_PASSWORD", default="creche_dev_password"),
        "HOST": env("POSTGRES_HOST", default="localhost"),
        "PORT": env.int("POSTGRES_PORT", default=5432),
        "CONN_MAX_AGE": 60,
    }
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"

# ── Passwords ───────────────────────────────────────────────────────────
# Argon2id first: it is memory-hard, which matters because this database
# holds credentials guarding children's records (docs/authentication.md 1).
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
    "django.contrib.auth.hashers.BCryptSHA256PasswordHasher",
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 10},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ── i18n ────────────────────────────────────────────────────────────────
# The interface is French; the nursery timezone defines what "today" means
# for the timeline's local_date (docs/timeline.md 6).
LANGUAGE_CODE = "fr-fr"
TIME_ZONE = env("NURSERY_TIMEZONE", default="Africa/Tunis")
USE_I18N = True
USE_TZ = True

# ── Static & media ──────────────────────────────────────────────────────
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = env("MEDIA_URL", default="/media/")
MEDIA_ROOT = env("MEDIA_ROOT", default=str(BASE_DIR / "media"))

MAX_UPLOAD_SIZE_MB = env.int("MAX_UPLOAD_SIZE_MB", default=10)
MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024
ALLOWED_IMAGE_TYPES = env.list(
    "ALLOWED_IMAGE_TYPES", default=["image/jpeg", "image/png", "image/webp"]
)

# ── DRF ─────────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_PAGINATION_CLASS": "common.pagination.StandardPageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    # Every error leaves through one handler so the envelope in
    # docs/api.md 3 is guaranteed, not merely intended.
    "EXCEPTION_HANDLER": "common.exceptions.api_exception_handler",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": ("rest_framework.throttling.ScopedRateThrottle",),
    "DEFAULT_THROTTLE_RATES": {
        "login": f"{env.int('THROTTLE_LOGIN', default=10)}/hour",
        "claim": f"{env.int('THROTTLE_CLAIM', default=5)}/hour",
        "contact": f"{env.int('THROTTLE_CONTACT', default=5)}/hour",
        "user": f"{env.int('THROTTLE_USER', default=1000)}/hour",
    },
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Crèche Mamati API",
    "DESCRIPTION": "Nursery management and parent communication platform.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    # Several models expose a field called "status" with different choice
    # sets. Naming them explicitly keeps the generated client readable
    # instead of leaving auto-resolved names like "StatusBbeEnum".
    "ENUM_NAME_OVERRIDES": {
        "ChildStatusEnum": "apps.children.models.ChildStatus.choices",
        "DailyRecordStatusEnum": "apps.care.models.DailyRecordStatus.choices",
        "ActivityCategoryEnum": "apps.activities.models.ActivityCategory.choices",
        "RelationshipEnum": "apps.accounts.models.Relationship.choices",
        "ComplaintStatusEnum": "apps.complaints.models.ComplaintStatus.choices",
    },
}

# ── JWT ─────────────────────────────────────────────────────────────────
# The access token is short-lived and held in browser memory only; the
# refresh token travels in an httpOnly cookie and rotates on every use
# (docs/authentication.md 2).
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=env.int("ACCESS_TOKEN_LIFETIME_MINUTES", default=15)
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=env.int("REFRESH_TOKEN_LIFETIME_DAYS", default=7)
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

REFRESH_COOKIE_NAME = env("REFRESH_COOKIE_NAME", default="creche_refresh")
REFRESH_COOKIE_SECURE = env.bool("REFRESH_COOKIE_SECURE", default=False)
REFRESH_COOKIE_SAMESITE = env("REFRESH_COOKIE_SAMESITE", default="Strict")
REFRESH_COOKIE_DOMAIN = env("REFRESH_COOKIE_DOMAIN", default=None) or None

# ── Child access codes (docs/authentication.md 4) ───────────────────────
# Deliberately keyed with its own secret: rotating DJANGO_SECRET_KEY should
# not silently invalidate every unclaimed enrolment code, and a database
# leak without this key reveals nothing about the codes.
ACCESS_CODE_HMAC_KEY = env("ACCESS_CODE_HMAC_KEY", default="insecure-dev-hmac-key")
ACCESS_CODE_TTL_DAYS = env.int("ACCESS_CODE_TTL_DAYS", default=30)
ACCESS_CODE_PREFIX = env("ACCESS_CODE_PREFIX", default="MAM")

# ── CORS ────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS", default=["http://localhost:5173"]
)
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = env.list(
    "CSRF_TRUSTED_ORIGINS", default=["http://localhost:5173"]
)
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:5173")

# ── Nursery ─────────────────────────────────────────────────────────────
NURSERY_NAME = env("NURSERY_NAME", default="Crèche Mamati")
NURSERY_EMAIL = env("NURSERY_EMAIL", default="contact@creche-mamati.com")
NURSERY_PHONE = env("NURSERY_PHONE", default="")
NURSERY_ADDRESS = env("NURSERY_ADDRESS", default="")

# ── Email ───────────────────────────────────────────────────────────────
EMAIL_BACKEND = env(
    "EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend"
)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="no-reply@creche-mamati.com")

# ── Logging ─────────────────────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {name} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "verbose"},
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django.db.backends": {"level": "WARNING", "handlers": ["console"], "propagate": False},
    },
}
