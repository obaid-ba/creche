"""Payment serializers.

Amounts go out as strings, not JSON numbers: a dinar has three decimal
places and JSON numbers are IEEE-754 doubles, so 72.500 is not guaranteed
to survive the round trip. DRF's DecimalField does this by default and
``COERCE_DECIMAL_TO_STRING`` must stay on for it.
"""
from __future__ import annotations

from decimal import Decimal

from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from .models import ChildFee, Invoice, InvoiceStatus, Payment, PaymentMethod
from .services import default_due_date, fee_for, first_of_month


class ChildFeeSerializer(serializers.ModelSerializer):
    child_name = serializers.CharField(source="child.full_name", read_only=True)

    class Meta:
        model = ChildFee
        fields = (
            "id", "child", "child_name", "monthly_amount", "effective_from",
            "note", "created_at",
        )
        read_only_fields = ("id", "child_name", "created_at")

    def validate_monthly_amount(self, value: Decimal) -> Decimal:
        if value < 0:
            raise serializers.ValidationError(_("Le tarif ne peut pas être négatif."))
        return value


class PaymentSerializer(serializers.ModelSerializer):
    method_label = serializers.SerializerMethodField()
    recorded_by_name = serializers.SerializerMethodField()
    is_voided = serializers.BooleanField(read_only=True)

    class Meta:
        model = Payment
        fields = (
            "id", "invoice", "amount", "method", "method_label", "received_on",
            "reference", "note", "is_voided", "voided_at", "voided_reason",
            "recorded_by_name", "created_at",
        )
        read_only_fields = (
            "id", "method_label", "is_voided", "voided_at", "voided_reason",
            "recorded_by_name", "created_at",
        )

    def get_method_label(self, obj) -> str:
        return PaymentMethod(obj.method).label

    def get_recorded_by_name(self, obj) -> str:
        user = obj.recorded_by
        return user.get_full_name() if user is not None else ""

    def validate_amount(self, value: Decimal) -> Decimal:
        if value <= 0:
            raise serializers.ValidationError(
                _("Le montant doit être supérieur à zéro.")
            )
        return value


class ParentPaymentSerializer(PaymentSerializer):
    """A parent sees what was received, not who keyed it in."""

    class Meta(PaymentSerializer.Meta):
        fields = (
            "id", "amount", "method", "method_label", "received_on",
            "reference", "is_voided",
        )
        read_only_fields = fields


class InvoiceSerializer(serializers.ModelSerializer):
    child_name = serializers.CharField(source="child.full_name", read_only=True)
    amount_paid = serializers.DecimalField(
        max_digits=10, decimal_places=3, read_only=True
    )
    balance = serializers.DecimalField(
        max_digits=10, decimal_places=3, read_only=True
    )
    status = serializers.CharField(read_only=True)
    status_label = serializers.SerializerMethodField()
    payments = PaymentSerializer(many=True, read_only=True)

    class Meta:
        model = Invoice
        fields = (
            "id", "child", "child_name", "period", "amount_due", "amount_paid",
            "balance", "status", "status_label", "due_date", "note",
            "cancelled_at", "cancelled_reason", "payments", "created_at",
        )
        read_only_fields = (
            "id", "child_name", "amount_paid", "balance", "status",
            "status_label", "cancelled_at", "cancelled_reason", "payments",
            "created_at",
        )

    def get_status_label(self, obj) -> str:
        return InvoiceStatus(obj.status).label

    def validate(self, attrs):
        period = attrs.get("period", getattr(self.instance, "period", None))
        due = attrs.get("due_date", getattr(self.instance, "due_date", None))
        if period is not None and due is not None:
            if due < first_of_month(period):
                raise serializers.ValidationError(
                    {"due_date": _("L'échéance ne peut pas précéder le mois facturé.")}
                )
        return attrs

    def create(self, validated_data):
        # A manual invoice still gets sensible defaults, so staff adding
        # one for a mid-year arrival do not have to compute them.
        period = first_of_month(validated_data["period"])
        validated_data["period"] = period
        validated_data.setdefault("due_date", default_due_date(period))
        if "amount_due" not in validated_data:
            amount = fee_for(validated_data["child"].id, period)
            if amount is None:
                raise serializers.ValidationError(
                    {"amount_due": _("Aucun tarif n'est défini pour cet enfant.")}
                )
            validated_data["amount_due"] = amount
        return super().create(validated_data)


class ParentInvoiceSerializer(InvoiceSerializer):
    """No internal note, and no record of which member of staff issued it."""

    payments = ParentPaymentSerializer(many=True, read_only=True)

    class Meta(InvoiceSerializer.Meta):
        fields = (
            "id", "child", "child_name", "period", "amount_due", "amount_paid",
            "balance", "status", "status_label", "due_date", "payments",
        )
        read_only_fields = fields


class GenerateInvoicesSerializer(serializers.Serializer):
    """Which month to bill."""

    period = serializers.DateField(
        help_text="Any date in the month; it is snapped to the first."
    )
    due_day = serializers.IntegerField(min_value=1, max_value=28, default=10)


class VoidPaymentSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=200, allow_blank=False)


class CancelInvoiceSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=200, allow_blank=False)
