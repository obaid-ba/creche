"""Care routes (docs/api.md 6-7)."""
from django.urls import path

from .views import (
    ChildDailyRecordPublishView,
    ChildDailyRecordView,
    ChildTimelineView,
    EventTypeListView,
    TimelineEventViewSet,
)

urlpatterns = [
    path(
        "children/<uuid:child_id>/timeline/",
        ChildTimelineView.as_view(),
        name="child-timeline",
    ),
    path(
        "children/<uuid:child_id>/daily-record/",
        ChildDailyRecordView.as_view(),
        name="child-daily-record",
    ),
    path(
        "children/<uuid:child_id>/daily-record/publish/",
        ChildDailyRecordPublishView.as_view(),
        name="child-daily-record-publish",
    ),
    path(
        "timeline-events/<uuid:pk>/",
        TimelineEventViewSet.as_view({"patch": "partial_update", "delete": "destroy"}),
        name="timeline-event-detail",
    ),
    path(
        "timeline-events/<uuid:pk>/end/",
        TimelineEventViewSet.as_view({"post": "end"}),
        name="timeline-event-end",
    ),
    path("timeline/event-types/", EventTypeListView.as_view(), name="event-types"),
]
