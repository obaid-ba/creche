"""Messaging routes (docs/api.md 9)."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ConversationViewSet, UnreadCountView

router = DefaultRouter()
router.register("conversations", ConversationViewSet, basename="conversation")

urlpatterns = [
    path("messages/unread-count/", UnreadCountView.as_view(), name="unread-count"),
    path("", include(router.urls)),
]
