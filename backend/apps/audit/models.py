"""Append-only audit trail for sensitive operations.

Required by the security brief (17). Cross-cutting, so it lives in its own
app rather than inside a feature module.

The table is append-only by convention *and* by omission: no update or
delete path is exposed anywhere in the application, and the model
deliberately has no ``save`` override that would let a caller mutate an
existing row.
"""
from __future__ import annotations

from django.db import models

from common.models import UUIDModel


class AuditAction(models.TextChoices):
    # Authentication
    LOGIN_SUCCESS = "LOGIN_SUCCESS", "Connexion réussie"
    LOGIN_FAILED = "LOGIN_FAILED", "Échec de connexion"
    LOGOUT = "LOGOUT", "Déconnexion"
    PASSWORD_CHANGED = "PASSWORD_CHANGED", "Mot de passe modifié"

    # Access codes
    CODE_ISSUED = "CODE_ISSUED", "Code d'accès généré"
    CODE_REVOKED = "CODE_REVOKED", "Code d'accès révoqué"
    CODE_CLAIMED = "CODE_CLAIMED", "Code d'accès utilisé"
    CODE_CLAIM_FAILED = "CODE_CLAIM_FAILED", "Échec d'utilisation d'un code"

    # Children
    CHILD_CREATED = "CHILD_CREATED", "Enfant créé"
    CHILD_UPDATED = "CHILD_UPDATED", "Enfant modifié"
    CHILD_ARCHIVED = "CHILD_ARCHIVED", "Enfant archivé"
    CHILD_RESTORED = "CHILD_RESTORED", "Enfant restauré"
    CHILD_DELETED = "CHILD_DELETED", "Enfant supprimé"

    # Guardianship
    GUARDIAN_LINKED = "GUARDIAN_LINKED", "Parent rattaché"
    GUARDIAN_REVOKED = "GUARDIAN_REVOKED", "Rattachement révoqué"

    # Complaints
    COMPLAINT_STATUS_CHANGED = "COMPLAINT_STATUS_CHANGED", "Statut de réclamation modifié"


class AuditLog(UUIDModel):
    actor = models.ForeignKey(
        "accounts.User", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="audit_entries",
    )
    # Kept alongside the FK because the actor may later be deleted, and an
    # audit entry that cannot say who acted is close to useless.
    actor_email = models.EmailField(blank=True)

    action = models.CharField(max_length=50, choices=AuditAction.choices)
    object_type = models.CharField(max_length=50, blank=True)
    object_id = models.UUIDField(null=True, blank=True)

    child = models.ForeignKey(
        "children.Child", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="audit_entries",
    )

    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "audit_auditlog"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["child", "-created_at"]),
            models.Index(fields=["actor", "-created_at"]),
            models.Index(fields=["action", "-created_at"]),
        ]
        verbose_name = "Entrée d'audit"
        verbose_name_plural = "Entrées d'audit"

    def __str__(self) -> str:
        return f"{self.created_at:%Y-%m-%d %H:%M} {self.action} {self.actor_email}"
