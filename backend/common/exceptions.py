"""Single exit point for API errors.

Every non-2xx response leaves through :func:`api_exception_handler`, so the
envelope documented in docs/api.md 3 is guaranteed rather than merely
intended. The frontend therefore needs exactly one translator.
"""
import logging
import uuid

from django.core.exceptions import PermissionDenied
from django.db import IntegrityError
from django.http import Http404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)

# Machine-readable code + the French message the parent or staff member sees.
ERROR_CODES = {
    status.HTTP_400_BAD_REQUEST: (
        "validation_error",
        "Les données envoyées sont invalides.",
    ),
    status.HTTP_401_UNAUTHORIZED: (
        "authentication_failed",
        "Authentification requise ou session expirée.",
    ),
    status.HTTP_403_FORBIDDEN: (
        "permission_denied",
        "Vous n'avez pas l'autorisation d'effectuer cette action.",
    ),
    status.HTTP_404_NOT_FOUND: (
        "not_found",
        "La ressource demandée est introuvable.",
    ),
    status.HTTP_405_METHOD_NOT_ALLOWED: (
        "method_not_allowed",
        "Méthode non autorisée.",
    ),
    status.HTTP_409_CONFLICT: ("conflict", "Cette opération entre en conflit avec l'état actuel."),
    status.HTTP_413_REQUEST_ENTITY_TOO_LARGE: (
        "payload_too_large",
        "Le fichier envoyé est trop volumineux.",
    ),
    status.HTTP_415_UNSUPPORTED_MEDIA_TYPE: (
        "unsupported_media_type",
        "Ce type de fichier n'est pas accepté.",
    ),
    status.HTTP_429_TOO_MANY_REQUESTS: (
        "rate_limited",
        "Trop de tentatives. Veuillez réessayer plus tard.",
    ),
    status.HTTP_500_INTERNAL_SERVER_ERROR: (
        "server_error",
        "Une erreur interne est survenue. Veuillez réessayer.",
    ),
}


def _normalise_details(detail):
    """Reduce DRF's several detail shapes to one predictable structure."""
    if isinstance(detail, dict):
        return {
            key: value if isinstance(value, list) else [value]
            for key, value in detail.items()
        }
    if isinstance(detail, list):
        return {"non_field_errors": detail}
    if detail is None:
        return {}
    return {"non_field_errors": [str(detail)]}


def api_exception_handler(exc, context):
    if isinstance(exc, Http404):
        exc = None
        response = Response(status=status.HTTP_404_NOT_FOUND)
    elif isinstance(exc, PermissionDenied):
        exc = None
        response = Response(status=status.HTTP_403_FORBIDDEN)
    elif isinstance(exc, IntegrityError):
        # A database constraint fired - the request conflicts with a rule the
        # schema enforces (docs/database.md 10). Never leak the SQL text.
        logger.warning("IntegrityError: %s", exc)
        exc = None
        response = Response(status=status.HTTP_409_CONFLICT)
    else:
        response = drf_exception_handler(exc, context)

    if response is None:
        # Unhandled: log with a traceback, return an opaque body.
        request_id = str(uuid.uuid4())
        logger.exception("Unhandled exception [request_id=%s]", request_id)
        code, message = ERROR_CODES[status.HTTP_500_INTERNAL_SERVER_ERROR]
        return Response(
            {"error": {"code": code, "message": message, "details": {},
                       "request_id": request_id}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    code, message = ERROR_CODES.get(
        response.status_code, ("error", "Une erreur est survenue.")
    )
    detail = getattr(exc, "detail", None) if exc is not None else None
    normalised = _normalise_details(detail)

    # Promote a serializer's own message when it has nowhere else to show.
    #
    # DRF wraps a bare `ValidationError("Identifiants invalides.")` into
    # `["Identifiants invalides."]`, which normalises to
    # `non_field_errors`. Without this, that specific message was buried
    # in `details` while the banner showed the generic "Les données
    # envoyées sont invalides." — so a parent with a wrong password was
    # told their data was malformed.
    #
    # Field-specific errors are deliberately NOT promoted: the form
    # already renders them beside the input, and repeating one in the
    # banner would say the same thing twice.
    non_field = normalised.get("non_field_errors")
    if non_field and len(normalised) == 1 and len(non_field) == 1:
        message = str(non_field[0])
    elif isinstance(detail, str):
        message = detail

    response.data = {
        "error": {
            "code": getattr(exc, "default_code", code) if exc is not None else code,
            "message": message,
            "details": normalised,
            "request_id": str(uuid.uuid4()),
        }
    }
    return response
