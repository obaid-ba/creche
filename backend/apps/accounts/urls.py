"""Account and authentication routes (docs/api.md 4)."""
from django.urls import path

from .views import (
    LinkChildView,
    LoginView,
    LogoutView,
    MeView,
    ParentClaimView,
    PasswordChangeView,
    RefreshView,
)

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", MeView.as_view(), name="auth-me"),
    path(
        "auth/password/change/",
        PasswordChangeView.as_view(),
        name="auth-password-change",
    ),
    path("auth/parent/claim/", ParentClaimView.as_view(), name="auth-parent-claim"),
    path(
        "auth/parent/link-child/",
        LinkChildView.as_view(),
        name="auth-parent-link-child",
    ),
]
