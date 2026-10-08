"""Payment endpoints.

A parent's scope is derived from guardianship through
``Child.objects.visible_to(user)``, never from a ``child`` parameter — an
id for someone else's child simply does not resolve, so the API cannot be
used to discover that a child exists (docs/authentication.md 5).
"""
from __future__ import annotations

from datetime import date

from django.db import transaction
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.audit.models import AuditAction
from apps.audit.services import record as record_audit
from apps.children.models import Child
from common.permissions import IsStaff

from .models import ChildFee, Invoice, Payment
from .serializers import (
    CancelInvoiceSerializer,
    ChildFeeSerializer,
    GenerateInvoicesSerializer,
    InvoiceSerializer,
    ParentInvoiceSerializer,
    PaymentSerializer,
    VoidPaymentSerializer,
)
from .services import first_of_month, generate_invoices


class ChildFeeViewSet(viewsets.ModelViewSet):
    """Staff only. A fee is nursery business, not something a parent sets."""

    serializer_class = ChildFeeSerializer
    permission_classes = [IsAuthenticated, IsStaff]

    def get_queryset(self):
        queryset = ChildFee.objects.select_related("child")
        child = self.request.query_params.get("child")
        if child:
            queryset = queryset.filter(child_id=child)
        return queryset

    def perform_create(self, serializer):
        fee = serializer.save(created_by=self.request.user)
        record_audit(
            action=AuditAction.FEE_SET, request=self.request,
            obj=fee, child=fee.child,
        )


class InvoiceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Invoice.objects.none()

        queryset = Invoice.objects.select_related("child").prefetch_related(
            # The money properties read these rows; without the prefetch
            # a page of invoices is a query per invoice.
            Prefetch("payments", queryset=Payment.objects.all())
        )

        if user.is_parent:
            queryset = queryset.filter(child__in=Child.objects.visible_to(user))

        params = self.request.query_params
        if params.get("period"):
            # Any date in the month is accepted and snapped, so a client
            # may send "2026-10" style first-of-month or a mid-month date.
            try:
                asked = date.fromisoformat(params["period"])
            except ValueError:
                return queryset.none()
            queryset = queryset.filter(period=first_of_month(asked))
        if params.get("from"):
            queryset = queryset.filter(period__gte=params["from"])
        if params.get("to"):
            queryset = queryset.filter(period__lte=params["to"])
        # Staff may narrow to one child; a parent's scope is already fixed.
        child = params.get("child")
        if child and user.is_staff_member:
            queryset = queryset.filter(child_id=child)
        return queryset

    def get_serializer_class(self):
        user = self.request.user
        if user.is_authenticated and user.is_parent:
            return ParentInvoiceSerializer
        return InvoiceSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve", "summary"):
            return super().get_permissions()
        return [permission() for permission in (IsAuthenticated, IsStaff)]

    def perform_create(self, serializer):
        invoice = serializer.save(issued_by=self.request.user)
        record_audit(
            action=AuditAction.INVOICE_ISSUED, request=self.request,
            obj=invoice, child=invoice.child,
        )

    def perform_destroy(self, instance):
        """Archive, never delete: a financial record is kept.

        ``POST /invoices/{id}/cancel/`` is the honest way to do this and
        records a reason; DELETE is accepted so the route behaves, but it
        archives rather than removing the row.
        """
        instance.archive(by=self.request.user)
        record_audit(
            action=AuditAction.INVOICE_CANCELLED, request=self.request,
            obj=instance, child=instance.child,
        )

    @extend_schema(request=GenerateInvoicesSerializer, responses=InvoiceSerializer)
    @action(detail=False, methods=["post"],
            permission_classes=[IsAuthenticated, IsStaff])
    def generate(self, request):
        """Issue the month's invoices for every active child."""
        serializer = GenerateInvoicesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = generate_invoices(
            serializer.validated_data["period"],
            issued_by=request.user,
            due_day=serializer.validated_data["due_day"],
        )
        if result.created:
            record_audit(
                action=AuditAction.INVOICES_GENERATED, request=request,
                **result.summary,
            )
        return Response(
            {
                **result.summary,
                "already_invoiced": result.already_invoiced,
                "no_fee_set": result.no_fee_set,
                "invoices": InvoiceSerializer(
                    self.get_queryset().filter(
                        id__in=[i.id for i in result.created]
                    ),
                    many=True,
                    context=self.get_serializer_context(),
                ).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(request=CancelInvoiceSerializer, responses=InvoiceSerializer)
    @action(detail=True, methods=["post"],
            permission_classes=[IsAuthenticated, IsStaff])
    def cancel(self, request, pk=None):
        """Cancel with a reason, keeping the row and its payments."""
        invoice = self.get_object()
        serializer = CancelInvoiceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            invoice.cancelled_at = timezone.now()
            invoice.cancelled_reason = serializer.validated_data["reason"]
            invoice.save(update_fields=["cancelled_at", "cancelled_reason",
                                        "updated_at"])
            record_audit(
                action=AuditAction.INVOICE_CANCELLED, request=request,
                obj=invoice, child=invoice.child,
                reason=invoice.cancelled_reason,
            )
        return Response(
            InvoiceSerializer(invoice, context=self.get_serializer_context()).data
        )

    @extend_schema(request=PaymentSerializer, responses=InvoiceSerializer)
    @action(detail=True, methods=["post"], url_path="payments",
            permission_classes=[IsAuthenticated, IsStaff])
    def add_payment(self, request, pk=None):
        """Record money received against this invoice."""
        invoice = self.get_object()
        if invoice.cancelled_at is not None:
            return Response(
                {"detail": _("Cette facture est annulée.")},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = PaymentSerializer(data={**request.data, "invoice": invoice.pk})
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            payment = serializer.save(recorded_by=request.user)
            record_audit(
                action=AuditAction.PAYMENT_RECORDED, request=request,
                obj=payment, child=invoice.child,
                amount=str(payment.amount), method=payment.method,
            )

        invoice.refresh_from_db()
        return Response(
            InvoiceSerializer(
                self.get_queryset().get(pk=invoice.pk),
                context=self.get_serializer_context(),
            ).data,
            status=status.HTTP_201_CREATED,
        )


class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    """Payments on their own, for a staff ledger view."""

    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated, IsStaff]

    def get_queryset(self):
        queryset = Payment.objects.select_related(
            "invoice__child", "recorded_by"
        )
        params = self.request.query_params
        if params.get("from"):
            queryset = queryset.filter(received_on__gte=params["from"])
        if params.get("to"):
            queryset = queryset.filter(received_on__lte=params["to"])
        if params.get("method"):
            queryset = queryset.filter(method=params["method"])
        return queryset

    @extend_schema(request=VoidPaymentSerializer, responses=PaymentSerializer)
    @action(detail=True, methods=["post"])
    def void(self, request, pk=None):
        """Reverse a mistaken payment, keeping the row and the reason."""
        payment = self.get_object()
        if payment.is_voided:
            return Response(
                {"detail": _("Ce paiement est déjà annulé.")},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = VoidPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            payment.void(reason=serializer.validated_data["reason"], by=request.user)
            record_audit(
                action=AuditAction.PAYMENT_VOIDED, request=request,
                obj=payment, child=payment.invoice.child,
                reason=payment.voided_reason,
            )
        return Response(PaymentSerializer(payment).data)
