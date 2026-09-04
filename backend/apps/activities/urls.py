"""Activity routes (docs/api.md 8)."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ActivityViewSet

router = DefaultRouter()
router.register("activities", ActivityViewSet, basename="activity")

urlpatterns = [path("", include(router.urls))]
