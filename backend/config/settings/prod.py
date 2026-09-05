"""Production settings: every protection on, no debugging affordances."""
from .base import *  # noqa: F401,F403
from .base import env

DEBUG = False
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS")

# JSON only - no browsable API surface in production.
REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = (  # noqa: F405
    "rest_framework.renderers.JSONRenderer",
)

# ── Static files ────────────────────────────────────────────────────────
# WhiteNoise serves Django's own static assets (admin, DRF) directly from
# the app container, hashed and compressed, so no second web server is
# needed just for them. It must sit immediately after SecurityMiddleware.
MIDDLEWARE.insert(  # noqa: F405
    MIDDLEWARE.index("django.middleware.security.SecurityMiddleware") + 1,  # noqa: F405
    "whitenoise.middleware.WhiteNoiseMiddleware",
)

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

# ── Transport security ──────────────────────────────────────────────────
# On by default, but switchable: when TLS is terminated further out (a
# load balancer, an ingress, a tunnel) and that hop does not set
# X-Forwarded-Proto, redirecting here produces an infinite loop. Turning
# it off is only correct when something in front is already enforcing
# HTTPS — hence the explicit name.
SECURE_SSL_REDIRECT = env.bool("DJANGO_SECURE_SSL_REDIRECT", default=True)
SECURE_HSTS_SECONDS = 31_536_000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# ── Cookies ─────────────────────────────────────────────────────────────
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Strict"
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_SAMESITE = "Strict"
REFRESH_COOKIE_SECURE = True

# ── Headers ─────────────────────────────────────────────────────────────
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"

# Fail loudly rather than silently running insecure in production.
if SECRET_KEY.startswith("insecure-"):
    raise RuntimeError("DJANGO_SECRET_KEY must be set in production.")
if ACCESS_CODE_HMAC_KEY.startswith("insecure-"):  # noqa: F405
    raise RuntimeError("ACCESS_CODE_HMAC_KEY must be set in production.")
