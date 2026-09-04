"""Dashboard routes (docs/api.md 11)."""
from django.urls import path

from .views import ParentDashboardView, StaffDashboardView

urlpatterns = [
    path("dashboard/parent/", ParentDashboardView.as_view(), name="dashboard-parent"),
    path("dashboard/staff/", StaffDashboardView.as_view(), name="dashboard-staff"),
]
