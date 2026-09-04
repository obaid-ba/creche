"""Refresh-token cookie handling.

The refresh token is set as an httpOnly, Secure, SameSite=Strict cookie so
that no JavaScript on the origin can read it. The short-lived access token
is returned in the response body and kept in browser memory instead
(docs/authentication.md 2).
"""
from __future__ import annotations

from django.conf import settings

# Scoped to the refresh endpoint so the long-lived credential is not
# attached to every ordinary API call - it is only sent where it is used.
REFRESH_COOKIE_PATH = "/api/auth/"


def set_refresh_cookie(response, token: str):
    response.set_cookie(
        settings.REFRESH_COOKIE_NAME,
        token,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        domain=settings.REFRESH_COOKIE_DOMAIN,
        path=REFRESH_COOKIE_PATH,
    )
    return response


def clear_refresh_cookie(response):
    response.delete_cookie(
        settings.REFRESH_COOKIE_NAME,
        domain=settings.REFRESH_COOKIE_DOMAIN,
        path=REFRESH_COOKIE_PATH,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
    )
    return response


def get_refresh_token(request) -> str | None:
    return request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
