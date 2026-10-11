import os

from django.db import connection
from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework import serializers
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.response import Response


class HealthSerializer(serializers.Serializer):
    """Declared so the OpenAPI schema is complete rather than guessed."""

    status = serializers.CharField()
    database = serializers.CharField()
    version = serializers.CharField()
    branch = serializers.CharField()


def _deployed_version() -> tuple[str, str]:
    """The commit this process is actually running.

    Without it, "is my change deployed?" can only be answered by probing
    for a route that the new code adds and the old one lacks — which is
    how an un-deployed payments app looked like a broken payments app for
    a day. Render injects these on every build; empty locally, which is
    itself the honest answer there.

    A short commit hash discloses nothing about the code behind it, so
    this stays on the unauthenticated endpoint where a deploy check is
    actually useful.
    """
    commit = os.environ.get("RENDER_GIT_COMMIT", "")
    branch = os.environ.get("RENDER_GIT_BRANCH", "")
    return commit[:7], branch


@extend_schema(
    responses=HealthSerializer,
    description="Liveness and database reachability.",
    examples=[
        OpenApiExample(
            "Healthy",
            value={
                "status": "ok", "database": "ok",
                "version": "3d863e1", "branch": "main",
            },
            response_only=True,
        )
    ],
)
@api_view(["GET"])
@authentication_classes([])
@permission_classes([])
def health_check(_request):
    """Liveness + database reachability, for Compose and uptime checks."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        database = "ok"
    except Exception:  # pragma: no cover - only on a real outage
        database = "error"

    commit, branch = _deployed_version()
    return Response(
        {"status": "ok", "database": database, "version": commit, "branch": branch}
    )
