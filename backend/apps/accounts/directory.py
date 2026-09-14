"""Parent and staff directories (brief §20: /staff/parents, /staff/settings).

Both are staff-facing address books. Neither exposes anything a staff
member cannot already reach through the children list — the point is to
approach the same data from the adult's side rather than the child's.
"""
from __future__ import annotations

from django.db.models import Prefetch, Q
from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from common.permissions import IsAdmin, IsStaff

from .models import Guardianship, ParentProfile, Role, StaffProfile, User


class ParentChildSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    first_name = serializers.CharField(read_only=True)
    last_name = serializers.CharField(read_only=True)
    relationship = serializers.CharField(read_only=True)
    is_primary = serializers.BooleanField(read_only=True)


class ParentListSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="user.id", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)
    is_active = serializers.BooleanField(source="user.is_active", read_only=True)
    last_login_at = serializers.DateTimeField(
        source="user.last_login_at", read_only=True
    )
    children = serializers.SerializerMethodField()

    class Meta:
        model = ParentProfile
        fields = (
            "id", "first_name", "last_name", "email", "phone",
            "address", "emergency_phone",
            "is_active", "last_login_at", "children",
        )
        read_only_fields = fields

    def get_children(self, obj) -> list[dict]:
        # Uses the viewset's prefetch of active guardianships.
        return [
            {
                "id": str(link.child_id),
                "first_name": link.child.first_name,
                "last_name": link.child.last_name,
                "relationship": link.relationship,
                "is_primary": link.is_primary,
            }
            for link in obj.guardianships.all()
        ]


class ParentViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    permission_classes = [IsAuthenticated, IsStaff]
    serializer_class = ParentListSerializer
    queryset = ParentProfile.objects.none()

    def get_queryset(self):
        queryset = (
            ParentProfile.objects.select_related("user")
            .prefetch_related(
                Prefetch(
                    "guardianships",
                    queryset=Guardianship.objects.filter(
                        revoked_at__isnull=True
                    ).select_related("child"),
                )
            )
            .order_by("user__last_name", "user__first_name")
        )

        search = self.request.query_params.get("search", "").strip()
        if search:
            # Match the adult or the child: staff usually remember the
            # child's name, not the parent's.
            queryset = queryset.filter(
                Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
                | Q(user__email__icontains=search)
                | Q(guardianships__child__first_name__icontains=search)
                | Q(guardianships__child__last_name__icontains=search)
            ).distinct()

        if self.request.query_params.get("unlinked") == "true":
            queryset = queryset.filter(guardianships__isnull=True)

        return queryset

class StaffMemberSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="user.id", read_only=True)
    first_name = serializers.CharField(source="user.first_name")
    last_name = serializers.CharField(source="user.last_name")
    email = serializers.EmailField(source="user.email", read_only=True)
    phone = serializers.CharField(source="user.phone", required=False, allow_blank=True)
    role = serializers.CharField(source="user.role", read_only=True)
    is_active = serializers.BooleanField(source="user.is_active", read_only=True)
    last_login_at = serializers.DateTimeField(
        source="user.last_login_at", read_only=True
    )

    class Meta:
        model = StaffProfile
        fields = (
            "id", "first_name", "last_name", "email", "phone", "role",
            "job_title", "assigned_age_group", "hired_on",
            "is_active", "last_login_at",
        )
        read_only_fields = ("id", "email", "role", "is_active", "last_login_at")

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        for field, value in user_data.items():
            setattr(instance.user, field, value)
        if user_data:
            instance.user.save()

        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance


class StaffCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=80)
    last_name = serializers.CharField(max_length=80)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    job_title = serializers.CharField(max_length=80, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    role = serializers.ChoiceField(
        choices=[(Role.STAFF, "Personnel"), (Role.ADMIN, "Administrateur")],
        default=Role.STAFF,
    )

    def validate_email(self, value: str) -> str:
        email = value.lower().strip()
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError(_("Cette adresse e-mail est déjà utilisée."))
        return email

    def validate_password(self, value: str) -> str:
        from django.contrib.auth import password_validation

        password_validation.validate_password(value)
        return value


class StaffViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Staff directory. Reading is staff-wide; changing anything is admin."""

    permission_classes = [IsAuthenticated, IsStaff]
    serializer_class = StaffMemberSerializer
    queryset = StaffProfile.objects.none()

    def get_queryset(self):
        return (
            StaffProfile.objects.select_related("user")
            .order_by("user__last_name", "user__first_name")
        )

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return super().get_permissions()
        return [permission() for permission in (IsAuthenticated, IsAdmin)]

    @extend_schema(request=StaffCreateSerializer, responses=StaffMemberSerializer)
    def create(self, request):
        serializer = StaffCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        from django.db import transaction

        with transaction.atomic():
            user = User.objects.create_user(
                email=data["email"],
                password=data["password"],
                first_name=data["first_name"],
                last_name=data["last_name"],
                phone=data.get("phone", ""),
                role=data["role"],
            )
            profile = StaffProfile.objects.create(
                user=user, job_title=data.get("job_title", "")
            )

        return Response(
            StaffMemberSerializer(profile, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(request=None, responses=StaffMemberSerializer)
    @action(detail=True, methods=["post"], url_path="deactivate")
    def deactivate(self, request, pk=None):
        """Deactivate rather than delete, so the audit trail keeps a name."""
        profile = self.get_object()

        if profile.user_id == request.user.id:
            return Response(
                {"detail": _("Vous ne pouvez pas désactiver votre propre compte.")},
                status=status.HTTP_409_CONFLICT,
            )

        profile.user.is_active = False
        profile.user.save(update_fields=["is_active"])
        return Response(StaffMemberSerializer(profile).data)

    @extend_schema(request=None, responses=StaffMemberSerializer)
    @action(detail=True, methods=["post"], url_path="reactivate")
    def reactivate(self, request, pk=None):
        profile = self.get_object()
        profile.user.is_active = True
        profile.user.save(update_fields=["is_active"])
        return Response(StaffMemberSerializer(profile).data)
