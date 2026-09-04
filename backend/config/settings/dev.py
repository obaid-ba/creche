"""Development settings: convenience on, protections that would block local work off."""
from .base import *  # noqa: F401,F403
from .base import env

DEBUG = True
ALLOWED_HOSTS = ["*"]

# Browsable API is genuinely useful while building; it is absent in prod.
REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = (  # noqa: F405
    "rest_framework.renderers.JSONRenderer",
    "rest_framework.renderers.BrowsableAPIRenderer",
)

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Served by Django only in dev; production puts a real web server in front.
MEDIA_ROOT = env("MEDIA_ROOT", default=str(BASE_DIR / "media"))  # noqa: F405
