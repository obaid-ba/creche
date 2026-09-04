"""Pagination styles.

Page numbers for admin tables where a total is genuinely useful; cursors for
append-heavy time-ordered feeds, which stay stable under concurrent inserts
(docs/api.md 2).
"""
from collections import OrderedDict

from rest_framework.pagination import CursorPagination, PageNumberPagination
from rest_framework.response import Response


class StandardPageNumberPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response(
            OrderedDict(
                [
                    ("count", self.page.paginator.count),
                    ("page", self.page.number),
                    ("page_size", self.get_page_size(self.request)),
                    ("total_pages", self.page.paginator.num_pages),
                    ("results", data),
                ]
            )
        )


class TimelineCursorPagination(CursorPagination):
    """Ordered by when things happened, not when they were typed in.

    Staff often record a 10:30 nap at 11:15, so ordering by ``created_at``
    would show the day out of order (docs/timeline.md 4.1).
    """

    page_size = 50
    max_page_size = 200
    page_size_query_param = "page_size"
    ordering = "occurred_at"


class MessageCursorPagination(CursorPagination):
    page_size = 30
    max_page_size = 100
    page_size_query_param = "page_size"
    ordering = "-created_at"
