from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Strictly read-only: the audit trail is append-only."""

    list_display = ("created_at", "action", "actor_email", "object_type", "child")
    list_filter = ("action", "created_at")
    search_fields = ("actor_email", "object_id")
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
