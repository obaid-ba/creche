from django.contrib import admin

from .models import Child


@admin.register(Child)
class ChildAdmin(admin.ModelAdmin):
    list_display = ("first_name", "last_name", "date_of_birth", "age_display",
                    "status")
    list_filter = ("status", "gender")
    search_fields = ("first_name", "last_name")
    readonly_fields = ("age_display", "age_group")

    def get_queryset(self, request):
        # Archived children must remain reachable for restore.
        return Child.all_objects.all()
