"""Child-scoped view mixin.

The single rule this enforces: a ``child_id`` from the client is never used
to *decide* access, only to look *within* a queryset the server has already
restricted to what the caller may see.

Because ``get_child()`` is the only way a view can obtain a child, the
ownership check cannot be forgotten on a new endpoint - and nested
resources (timeline, daily record, activities, conversations) inherit it
rather than reimplementing it (docs/authentication.md 5).
"""
from django.shortcuts import get_object_or_404


class ChildScopedMixin:
    child_url_kwarg = "child_id"

    def get_child(self):
        from apps.children.models import Child

        if not hasattr(self, "_child"):
            # 404 rather than 403: a 403 would confirm the child exists and
            # turn the endpoint into an enumeration oracle (docs/api.md 1).
            self._child = get_object_or_404(
                Child.objects.visible_to(self.request.user),
                pk=self.kwargs[self.child_url_kwarg],
            )
        return self._child
