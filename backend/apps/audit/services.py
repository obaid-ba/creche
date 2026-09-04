"""Helpers for writing audit entries.

Call :func:`record` inside the same transaction as the operation being
audited, so an entry can never survive a rolled-back change (or vice versa).
"""
from __future__ import annotations

from typing import Any

from .models import AuditLog


def client_ip(request) -> str | None:
    """Best-effort client IP.

    ``X-Forwarded-For`` is client-controlled and only meaningful behind a
    proxy that overwrites it, so the direct peer address is preferred and
    the header is used only as a fallback.
    """
    if request is None:
        return None

    remote = request.META.get("REMOTE_ADDR")
    if remote:
        return remote

    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    return forwarded.split(",")[0].strip() or None


def record(
    *,
    action: str,
    request=None,
    actor=None,
    obj=None,
    object_type: str = "",
    child=None,
    **metadata: Any,
) -> AuditLog:
    if actor is None and request is not None:
        candidate = getattr(request, "user", None)
        if candidate is not None and candidate.is_authenticated:
            actor = candidate

    return AuditLog.objects.create(
        actor=actor,
        actor_email=getattr(actor, "email", "") or metadata.pop("email", ""),
        action=action,
        object_type=object_type or (type(obj).__name__ if obj is not None else ""),
        object_id=getattr(obj, "pk", None),
        child=child,
        ip_address=client_ip(request),
        user_agent=(request.META.get("HTTP_USER_AGENT", "")[:255] if request else ""),
        metadata=metadata,
    )
