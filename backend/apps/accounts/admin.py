from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .access_codes import ChildAccessCode
from .models import Guardianship, ParentProfile, StaffProfile, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("email",)
    list_display = ("email", "first_name", "last_name", "role", "is_active")
    list_filter = ("role", "is_active", "is_staff")
    search_fields = ("email", "first_name", "last_name")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Identité", {"fields": ("first_name", "last_name", "phone")}),
        ("Rôle", {"fields": ("role", "is_active", "is_staff", "is_superuser")}),
        ("Dates", {"fields": ("last_login", "last_login_at")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "password1", "password2", "role"),
            },
        ),
    )
    readonly_fields = ("last_login", "last_login_at")
    filter_horizontal = ()


admin.site.register(ParentProfile)
admin.site.register(StaffProfile)


@admin.register(Guardianship)
class GuardianshipAdmin(admin.ModelAdmin):
    list_display = ("parent", "child", "relationship", "is_primary", "revoked_at")
    list_filter = ("relationship", "is_primary")


@admin.register(ChildAccessCode)
class ChildAccessCodeAdmin(admin.ModelAdmin):
    """Read-only: codes are issued through the API, never typed in by hand."""

    list_display = ("code_hint", "child", "issued_at", "expires_at",
                    "claimed_at", "revoked_at")
    readonly_fields = ("code_lookup", "code_hint")


admin.site.site_header = "Crèche Mamati — Administration"
admin.site.site_title = "Crèche Mamati"
admin.site.index_title = "Gestion"
