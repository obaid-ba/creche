import { Coins } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Alert, Button, Card, CardBody, CardHeader, Input } from "@/components/ui";
import { useLocale } from "@/i18n/useLocale";

import { useChildFees, useSetFee } from "../hooks";
import { formatMoney, formatPeriod, parseAmount } from "../money";

/** The current month, as an `<input type="month">` value. */
function thisMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * The child's monthly fee, and its history.
 *
 * Without this there was no way to price a child at all, so
 * "Générer les factures" reported every child under "aucun tarif défini"
 * and created nothing — the ledger could not be started.
 *
 * Fees are a dated history rather than one editable number: raising the
 * fee in June must not rewrite what the family owed in January, and an
 * issued invoice copies the amount in force that month. So this adds a
 * row rather than overwriting one, and shows what came before.
 */
export function ChildFeeCard({ childId }: { childId: string }) {
  const { t } = useTranslation();
  const locale = useLocale();

  const fees = useChildFees(childId);
  const setFee = useSetFee();

  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(thisMonth);
  const [error, setError] = useState<string | null>(null);

  // The API orders by -effective_from, so the first row is the newest.
  // "Current" means the newest row that has already started; a fee dated
  // next term is scheduled, not in force.
  const rows = fees.data?.results ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const current = rows.find((fee) => fee.effective_from <= today);
  const scheduled = rows.filter((fee) => fee.effective_from > today);

  function submit() {
    const parsed = parseAmount(amount);
    if (parsed === null) {
      setError(t("payments.invalidAmount"));
      return;
    }
    setError(null);
    setFee.mutate(
      {
        child: childId,
        monthly_amount: parsed,
        // The server snaps this to the first of the month anyway;
        // sending day 1 keeps the request honest about what it means.
        effective_from: `${month}-01`,
      },
      { onSuccess: () => setAmount("") },
    );
  }

  return (
    <Card>
      <CardHeader
        title={t("payments.feeTitle")}
        description={t("payments.feeHint")}
      />
      <CardBody className="space-y-4">
        {current === undefined ? (
          // Not a neutral empty state: until this is set, the child is
          // invisible to invoicing entirely.
          <Alert tone="danger">{t("payments.noFeeYet")}</Alert>
        ) : (
          <p className="text-sm text-ink-600">
            {t("payments.currentFee")}{" "}
            {/* An amount reads left-to-right in Arabic as well. */}
            <span dir="ltr" className="font-bold text-ink-900">
              {formatMoney(current.monthly_amount, locale)}
            </span>{" "}
            <span className="text-ink-500">
              ({t("payments.since", {
                month: formatPeriod(current.effective_from, locale),
              })})
            </span>
          </p>
        )}

        {scheduled.length > 0 && (
          <ul className="space-y-1 text-sm text-ink-500">
            {scheduled.map((fee) => (
              <li key={fee.id}>
                {t("payments.scheduledFee", {
                  month: formatPeriod(fee.effective_from, locale),
                })}{" "}
                <span dir="ltr" className="font-semibold">
                  {formatMoney(fee.monthly_amount, locale)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-end gap-3 border-t border-ink-100 pt-4">
          <div className="w-36">
            <Input
              label={t("payments.amount")}
              type="text"
              inputMode="decimal"
              placeholder="180,000"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="w-44">
            <Input
              label={t("payments.effectiveFrom")}
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </div>
          <Button
            leftIcon={<Coins className="size-4" />}
            isLoading={setFee.isPending}
            onClick={submit}
          >
            {t("payments.setFee")}
          </Button>
        </div>

        {error !== null && <Alert tone="danger">{error}</Alert>}
        {setFee.isError && <Alert tone="danger">{t("payments.setFeeFailed")}</Alert>}
        {fees.isError && <Alert tone="danger">{t("payments.feeLoadError")}</Alert>}
      </CardBody>
    </Card>
  );
}
