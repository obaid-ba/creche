"""Notification fan-out.

Every function here derives its recipients from the domain — a child's
active guardians, or the staff roster — so a caller cannot address a
notification to someone who should not receive it.

Call these inside the transaction that performs the change.
"""
from __future__ import annotations

from django.db import models
from django.utils.translation import gettext, gettext_lazy as _

from .models import Notification, NotificationType


def _guardian_users(child):
    """Active guardians of a child. Revoked links are excluded."""
    from apps.accounts.models import User

    return User.objects.filter(
        parent_profile__guardianships__child=child,
        parent_profile__guardianships__revoked_at__isnull=True,
        is_active=True,
    ).distinct()


def _staff_users():
    from apps.accounts.models import Role, User

    return User.objects.filter(
        role__in=(Role.STAFF, Role.ADMIN), is_active=True
    )


def _create_many(users, **fields) -> int:
    notifications = [Notification(user=user, **fields) for user in users]
    if not notifications:
        return 0
    Notification.objects.bulk_create(notifications)
    return len(notifications)


def notify_day_published(daily_record) -> int:
    child = daily_record.child
    return _create_many(
        _guardian_users(child),
        type=NotificationType.DAY_PUBLISHED,
        title=gettext("La journée de %(name)s est disponible")
        % {"name": child.first_name},
        body=_("Consultez le détail de la journée."),
        link="/parent/timeline",
        child=child,
    )


def notify_activity(activity, children) -> int:
    """One notification per guardian per participating child."""
    total = 0
    for child in children:
        total += _create_many(
            _guardian_users(child),
            type=NotificationType.NEW_ACTIVITY,
            title=gettext("%(name)s a participé à une activité")
            % {"name": child.first_name},
            body=activity.title,
            link="/parent/activities",
            child=child,
        )
    return total


def notify_complaint_created(complaint) -> int:
    """Staff only: the parent already knows they filed it."""
    return _create_many(
        _staff_users(),
        type=NotificationType.COMPLAINT_CREATED,
        title="Nouvelle réclamation",
        body=complaint.subject,
        link="/staff/complaints",
        child=complaint.child,
    )


def notify_complaint_status(complaint) -> int:
    """The parent who filed it."""
    from .models import Notification  # noqa: F401  (kept explicit)

    parent_user = complaint.parent.user
    if not parent_user.is_active:
        return 0

    return _create_many(
        [parent_user],
        type=NotificationType.COMPLAINT_UPDATED,
        title=f"Réclamation « {complaint.subject} »",
        body=f"Statut : {complaint.get_status_display()}.",
        link="/parent/complaints",
        child=complaint.child,
    )


def notify_complaint_reply(reply) -> int:
    """The other side of the conversation.

    Internal notes notify nobody — they are staff working notes and must
    not reach the family (docs/api.md 10).
    """
    if reply.is_internal:
        return 0

    complaint = reply.complaint
    author = reply.author

    if author is not None and author.is_staff_member:
        recipients: models.QuerySet | list = [complaint.parent.user]
        link = "/parent/complaints"
    else:
        recipients = _staff_users()
        link = "/staff/complaints"

    if author is not None and not isinstance(recipients, list):
        recipients = recipients.exclude(pk=author.pk)

    return _create_many(
        recipients,
        type=NotificationType.COMPLAINT_REPLY,
        title=f"Réponse · {complaint.subject}",
        body=reply.body[:140],
        link=link,
        child=complaint.child,
    )
