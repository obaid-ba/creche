"""Child list filtering.

The age-group filter is the interesting one: it is translated into a
``date_of_birth`` range rather than computed per row, so PostgreSQL can use
the index and the result stays correctly paginated (docs/architecture.md
8.1).
"""
from __future__ import annotations

import django_filters as filters
from django.db.models import Q

from common.age import GROUP_BOUNDS, filter_queryset_by_group

from .models import Child, ChildStatus


class ChildFilter(filters.FilterSet):
    age_group = filters.CharFilter(method="filter_age_group")
    status = filters.ChoiceFilter(choices=ChildStatus.choices)
    search = filters.CharFilter(method="filter_search")
    born_after = filters.DateFilter(field_name="date_of_birth", lookup_expr="gt")
    born_before = filters.DateFilter(field_name="date_of_birth", lookup_expr="lt")

    class Meta:
        model = Child
        fields = ("age_group", "status", "gender")

    def filter_age_group(self, queryset, _name, value):
        if not value:
            return queryset
        if value not in GROUP_BOUNDS:
            # An unknown group is a client error expressed as an empty page
            # rather than a 500.
            return queryset.none()
        return filter_queryset_by_group(queryset, value)

    def filter_search(self, queryset, _name, value):
        term = (value or "").strip()
        if not term:
            return queryset

        # Matches "Mohamed", "Benali" and "Mohamed Benali" without needing
        # the caller to know which field is which.
        parts = term.split()
        query = Q()
        for part in parts:
            query &= Q(first_name__icontains=part) | Q(last_name__icontains=part)
        return queryset.filter(query)
