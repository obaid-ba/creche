"""Child routes (docs/api.md 5)."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AgeGroupViewSet, ChildViewSet

router = DefaultRouter()
router.register("children", ChildViewSet, basename="child")
router.register("age-groups", AgeGroupViewSet, basename="age-group")

urlpatterns = [path("", include(router.urls))]
