import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Alert, Button, Input, Modal, Select } from "@/components/ui";
import { useLocale } from "@/i18n/useLocale";

import { useRecordPayment } from "../hooks";
import { formatMoney, parseAmount } from "../money";
import { METHOD_KEYS, type Invoice, type PaymentMethod } from "../types";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Records money that has already arrived.
 *
 * The amount defaults to the outstanding balance, which is what a family
 * hands over most of the time — but it stays editable, because paying in
 * two goes is ordinary and the ledger is built around partial payment.
 *
 * The caller mounts this per invoice with a `key`, so the defaults are
 * computed once in the initialiser rather than resynced by an effect.
 */
export function RecordPaymentModal({
  invoice,
  onClose,
}: {
  invoice: Invoice;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const record = useRecordPayment(invoice.id);

  const [amount, setAmount] = useState(() => {
    const outstanding = Number(invoice.balance);
    return Number.isFinite(outstanding) && outstanding > 0
      ? outstanding.toFixed(3)
      : "";
  });
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [receivedOn, setReceivedOn] = useState(todayISO);
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const parsed = parseAmount(amount);
    if (parsed === null) {
      setError(t("payments.invalidAmount"));
      return;
    }
    // Checked here rather than after the round trip: the server refuses
    // it too, but by then the dialog has lost what was typed.
    if (receivedOn > todayISO()) {
      setError(t("payments.futureDate"));
      return;
    }
    setError(null);
    record.mutate(
      {
        amount: parsed,
        method,
        received_on: receivedOn,
        ...(reference === "" ? {} : { reference }),
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t("payments.recordTitle")}
      description={invoice.child_name}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button isLoading={record.isPending} onClick={submit}>
            {t("payments.record")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-600">
          {t("payments.outstanding")}{" "}
          {/* An amount is read left-to-right in Arabic as well. */}
          <span dir="ltr" className="font-bold text-ink-900">
            {formatMoney(invoice.balance, locale)}
          </span>
        </p>

        <Input
          label={t("payments.amount")}
          type="text"
          inputMode="decimal"
          autoFocus
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />

        <Select
          label={t("payments.method")}
          value={method}
          options={Object.entries(METHOD_KEYS).map(([value, key]) => ({
            value,
            label: t(key),
          }))}
          onChange={(event) => setMethod(event.target.value as PaymentMethod)}
        />

        <Input
          label={t("payments.receivedOn")}
          type="date"
          max={todayISO()}
          value={receivedOn}
          onChange={(event) => setReceivedOn(event.target.value)}
        />

        <Input
          label={t("payments.reference")}
          hint={t("payments.referenceHint")}
          value={reference}
          onChange={(event) => setReference(event.target.value)}
        />

        {error !== null && <Alert tone="danger">{error}</Alert>}
        {record.isError && (
          <Alert tone="danger">{t("payments.recordFailed")}</Alert>
        )}
      </div>
    </Modal>
  );
}
