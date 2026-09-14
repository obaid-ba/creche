"""Account and authentication routes (docs/api.md 4)."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .directory import ParentViewSet, StaffViewSet
from .views import (
    LoginView,
    LogoutView,
    MeView,
    ParentCodeLoginView,
    PasswordChangeView,
    RefreshView,
)

router = DefaultRouter()
router.register("parents", ParentViewSet, basename="parent")
router.register("staff", StaffViewSet, basename="staff")

urlpatterns = [
    path("", include(router.urls)),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", MeView.as_view(), name="auth-me"),
    path(
        "auth/password/change/",
        PasswordChangeView.as_view(),
        name="auth-password-change",
    ),
    path(
        "auth/parent/code-login/",
        ParentCodeLoginView.as_view(),
        name="auth-parent-code-login",
    ),
]
