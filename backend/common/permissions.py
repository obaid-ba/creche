"""Role-based permission classes.

Composed onto viewsets rather than written as ``if`` statements in view
bodies, so the authorisation rules can be read and audited in one place
(docs/authentication.md 3).

These answer "what may this *role* do". They do **not** answer "may this
user touch *this row*" - that is ownership, and it is enforced by queryset
scoping in ``Child.objects.visible_to()`` (docs/authentication.md 5).
"""
from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsParent(BasePermission):
    message = "Réservé aux parents."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_parent)


class IsStaff(BasePermission):
    """Staff or admin - admin is a superset of staff."""

    message = "Réservé au personnel de la crèche."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_staff_member)


class IsAdmin(BasePermission):
    message = "Réservé aux administrateurs."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_admin)


class IsStaffOrReadOnly(BasePermission):
    message = "Seul le personnel peut modifier cette ressource."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        return request.method in SAFE_METHODS or user.is_staff_member
