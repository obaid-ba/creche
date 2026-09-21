"""Authentication endpoints.

The token split is the security-critical part: the access token goes in the
response body (the SPA holds it in memory), the refresh token goes in an
httpOnly cookie the browser manages. See docs/authentication.md 2.
"""
from __future__ import annotations

from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.audit.models import AuditAction
from apps.audit.services import record as record_audit

from .cookies import clear_refresh_cookie, get_refresh_token, set_refresh_cookie
from .serializers import (
    CurrentUserSerializer,
    LoginSerializer,
    ParentCodeLoginSerializer,
    PasswordChangeSerializer,
)


def _token_payload(user, request) -> tuple[dict, str]:
    """Build the login/claim response body and the refresh token."""
    refresh = RefreshToken.for_user(user)
    # Carried in the token so the SPA can route without a second request.
    refresh["role"] = user.role

    access = refresh.access_token
    body = {
        "access": str(access),
        "expires_in": int(access.lifetime.total_seconds()),
        "user": CurrentUserSerializer(user, context={"request": request}).data,
    }
    return body, str(refresh)


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    @extend_schema(
        request=LoginSerializer,
        responses={200: OpenApiResponse(description="Authenticated")},
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]

        user.last_login_at = timezone.now()
        user.save(update_fields=["last_login_at"])

        record_audit(
            action=AuditAction.LOGIN_SUCCESS, request=request, actor=user, obj=user
        )

        body, refresh = _token_payload(user, request)
        return set_refresh_cookie(Response(body, status=status.HTTP_200_OK), refresh)


@extend_schema(
    request=None,
    responses={200: OpenApiResponse(description="New access token issued")},
)
class RefreshView(APIView):
    """Exchange the refresh cookie for a new access token.

    Refresh tokens rotate and the previous one is blacklisted, so a stolen
    token is single-use. Presenting an already-rotated token fails here,
    which surfaces theft rather than hiding it.
    """

    permission_classes = [AllowAny]
    authentication_classes: list = []

    def post(self, request):
        raw = get_refresh_token(request)
        if not raw:
            return Response(
                {"detail": _("Session expirée.")}, status=status.HTTP_401_UNAUTHORIZED
            )

        try:
            refresh = RefreshToken(raw)
            # Rotation: invalidate the presented token before issuing a new
            # one, so it cannot be replayed.
            refresh.blacklist()
            user_id = refresh["user_id"]
        except TokenError:
            response = Response(
                {"detail": _("Session expirée.")}, status=status.HTTP_401_UNAUTHORIZED
            )
            return clear_refresh_cookie(response)

        from .models import User

        user = User.objects.filter(pk=user_id, is_active=True).first()
        if user is None:
            response = Response(
                {"detail": _("Session expirée.")}, status=status.HTTP_401_UNAUTHORIZED
            )
            return clear_refresh_cookie(response)

        body, new_refresh = _token_payload(user, request)
        return set_refresh_cookie(Response(body), new_refresh)


@extend_schema(
    request=None,
    responses={204: OpenApiResponse(description="Signed out")},
)
class LogoutView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []

    def post(self, request):
        raw = get_refresh_token(request)
        if raw:
            try:
                RefreshToken(raw).blacklist()
            except TokenError:
                # Already expired or blacklisted - logging out is still a
                # success from the caller's point of view.
                pass

        record_audit(action=AuditAction.LOGOUT, request=request)
        response = Response(status=status.HTTP_204_NO_CONTENT)
        return clear_refresh_cookie(response)


@extend_schema(
    request=CurrentUserSerializer,
    responses=CurrentUserSerializer,
)
class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            CurrentUserSerializer(request.user, context={"request": request}).data
        )

    def patch(self, request):
        serializer = CurrentUserSerializer(
            request.user, data=request.data, partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


@extend_schema(
    request=PasswordChangeSerializer,
    responses={204: OpenApiResponse(description="Password changed")},
)
class PasswordChangeView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        serializer = PasswordChangeSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Changing a password ends other sessions: the current refresh
        # cookie is cleared so the user re-authenticates.
        response = Response(status=status.HTTP_204_NO_CONTENT)
        return clear_refresh_cookie(response)


@extend_schema(
    request=ParentCodeLoginSerializer,
    responses={200: OpenApiResponse(description="Signed in")},
)
class ParentCodeLoginView(APIView):
    """The parent's only sign-in: an access code and their child's name."""

    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "code_login"

    def post(self, request):
        serializer = ParentCodeLoginSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        body, refresh = _token_payload(user, request)
        return set_refresh_cookie(Response(body, status=status.HTTP_200_OK), refresh)
