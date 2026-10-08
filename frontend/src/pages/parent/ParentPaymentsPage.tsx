import { Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";

import { PageShell } from "@/components/app";
import {
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui";
import { InvoiceStatusBadge } from "@/features/payments/components/InvoiceStatusBadge";
import { useInvoices } from "@/features/payments/hooks";
import { formatMoney, formatPeriod, isSettled } from "@/features/payments/money";
import { useLocale } from "@/i18n/useLocale";

/**
 * What a family owes, and what they have paid.
 *
 * Read-only by design: payment happens at the crèche, and the serializer
 * a parent gets carries no internal note and no record of which member of
 * staff keyed anything in. The list is already scoped by guardianship
 * server-side, so there is no child filter to pass here.
 */
export function ParentPaymentsPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const query = useInvoices({});

  const invoices = query.data?.results ?? [];
  const outstanding = invoices
    .filter((invoice) => invoice.status !== "CANCELLED")
    .reduce((total, invoice) => total + Number(invoice.balance), 0);

  return (
    <PageShell>
      <h1 className="font-display text-2xl font-extrabold text-secondary-900 sm:text-[1.75rem]">
        {t("payments.parentTitle")}
      </h1>
      <p className="mt-1 text-sm text-ink-500">{t("payments.parentLead")}</p>

      {query.isPending ? (
        <LoadingState label={t("payments.loading")} />
      ) : query.isError ? (
        <ErrorState
          description={t("payments.loadError")}
          onRetry={() => void query.refetch()}
        />
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={<Wallet className="size-6" />}
          title={t("payments.parentEmpty")}
          description={t("payments.parentEmptyHint")}
        />
      ) : (
        <>
          <Card className="mt-6">
            <CardBody>
              <p className="text-sm text-ink-500">
                {t("payments.totalOutstanding")}
              </p>
              <p
                dir="ltr"
                className={`mt-1 font-display text-3xl font-extrabold ${
                  outstanding > 0 ? "text-danger-700" : "text-success-700"
                }`}
              >
                {formatMoney(outstanding.toFixed(3), locale)}
              </p>
            </CardBody>
          </Card>

          <ul className="mt-5 space-y-3">
            {invoices.map((invoice) => (
              <li key={invoice.id}>
                <Card>
                  <CardBody className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-ink-900">
                        {formatPeriod(invoice.period, locale)}
                      </p>
                      <p className="mt-0.5 text-sm text-ink-500">
                        {invoice.child_name} ·{" "}
                        <span dir="ltr">
                          {formatMoney(invoice.amount_due, locale)}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {!isSettled(invoice.balance) && (
                        <span
                          dir="ltr"
                          className="font-bold text-danger-700"
                          aria-label={t("payments.outstanding")}
                        >
                          {formatMoney(invoice.balance, locale)}
                        </span>
                      )}
                      <InvoiceStatusBadge status={invoice.status} />
                    </div>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </PageShell>
  );
}
