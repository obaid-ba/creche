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


@extend_schema(
    responses=HealthSerializer,
    description="Liveness and database reachability.",
    examples=[
        OpenApiExample(
            "Healthy", value={"status": "ok", "database": "ok"},
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

    return Response({"status": "ok", "database": database})
