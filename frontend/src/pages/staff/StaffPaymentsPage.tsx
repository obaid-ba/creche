import { Receipt, Wallet } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PageShell } from "@/components/app";
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Pagination,
  Table,
  type Column,
} from "@/components/ui";
import { InvoiceStatusBadge } from "@/features/payments/components/InvoiceStatusBadge";
import { RecordPaymentModal } from "@/features/payments/components/RecordPaymentModal";
import { useGenerateInvoices, useInvoices } from "@/features/payments/hooks";
import { formatMoney, formatPeriod, isSettled } from "@/features/payments/money";
import type { Invoice } from "@/features/payments/types";
import { useLocale } from "@/i18n/useLocale";

/** The current month, as a `<input type="month">` value. */
function thisMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function StaffPaymentsPage() {
  const { t } = useTranslation();
  const locale = useLocale();

  const [month, setMonth] = useState(thisMonth);
  const [page, setPage] = useState(1);
  const [paying, setPaying] = useState<Invoice | null>(null);

  // The API wants a date; a month input gives "2026-10".
  const period = `${month}-01`;
  const query = useInvoices({ period, page });
  const generate = useGenerateInvoices();

  const rows = query.data?.results ?? [];
  const totals = rows.reduce(
    (acc, invoice) => ({
      due: acc.due + Number(invoice.amount_due),
      paid: acc.paid + Number(invoice.amount_paid),
    }),
    { due: 0, paid: 0 },
  );

  const columns: Column<Invoice>[] = [
    {
      key: "child",
      header: t("payments.child"),
      cell: (invoice: Invoice) => (
        <span className="font-semibold text-ink-800">{invoice.child_name}</span>
      ),
    },
    {
      key: "amount_due",
      align: "end" as const,
      header: t("payments.due"),
      cell: (invoice: Invoice) => (
        <span dir="ltr">{formatMoney(invoice.amount_due, locale)}</span>
      ),
    },
    {
      key: "amount_paid",
      align: "end" as const,
      header: t("payments.paid"),
      cell: (invoice: Invoice) => (
        <span dir="ltr">{formatMoney(invoice.amount_paid, locale)}</span>
      ),
    },
    {
      key: "balance",
      align: "end" as const,
      header: t("payments.balance"),
      cell: (invoice: Invoice) => (
        <span
          dir="ltr"
          className={
            isSettled(invoice.balance)
              ? "text-ink-500"
              : "font-bold text-danger-700"
          }
        >
          {formatMoney(invoice.balance, locale)}
        </span>
      ),
    },
    {
      key: "status",
      header: t("payments.status"),
      cell: (invoice: Invoice) => <InvoiceStatusBadge status={invoice.status} />,
    },
    {
      key: "actions",
      header: "",
      cell: (invoice: Invoice) =>
        invoice.status === "PAID" || invoice.status === "CANCELLED" ? null : (
          <Button size="sm" variant="outline" onClick={() => setPaying(invoice)}>
            {t("payments.record")}
          </Button>
        ),
    },
  ];

  return (
    <PageShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-secondary-900 sm:text-[1.75rem]">
            {t("payments.pageTitle")}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {formatPeriod(period, locale)}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Input
            label={t("payments.month")}
            type="month"
            value={month}
            onChange={(event) => {
              setPage(1);
              setMonth(event.target.value);
            }}
          />
          <Button
            leftIcon={<Receipt className="size-4" />}
            isLoading={generate.isPending}
            onClick={() => generate.mutate({ period })}
          >
            {t("payments.generate")}
          </Button>
        </div>
      </div>

      {/* Generation is idempotent, so this reports rather than warns —
          except for children nobody has priced, which is a real to-do. */}
      {generate.isSuccess && generate.data !== undefined && (
        <Alert
          tone={generate.data.no_fee_set.length > 0 ? "danger" : "success"}
          className="mb-5"
        >
          {t("payments.generated", { count: generate.data.created })}
          {generate.data.already_invoiced.length > 0 &&
            ` · ${t("payments.alreadyInvoiced", {
              count: generate.data.already_invoiced.length,
            })}`}
          {generate.data.no_fee_set.length > 0 && (
            <>
              {" · "}
              {t("payments.noFeeSet", {
                names: generate.data.no_fee_set.join(", "),
              })}
            </>
          )}
        </Alert>
      )}
      {generate.isError && (
        <Alert tone="danger" className="mb-5">
          {t("payments.generateFailed")}
        </Alert>
      )}

      {query.isPending ? (
        <LoadingState label={t("payments.loading")} />
      ) : query.isError ? (
        <ErrorState
          description={t("payments.loadError")}
          onRetry={() => void query.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Wallet className="size-6" />}
          title={t("payments.empty")}
          description={t("payments.emptyHint")}
          action={
            <Button size="sm" onClick={() => generate.mutate({ period })}>
              {t("payments.generate")}
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-5 rounded-panel bg-shell px-4 py-3 text-sm">
            <span>
              {t("payments.totalDue")}{" "}
              <strong dir="ltr">{formatMoney(totals.due.toFixed(3), locale)}</strong>
            </span>
            <span>
              {t("payments.totalPaid")}{" "}
              <strong dir="ltr">{formatMoney(totals.paid.toFixed(3), locale)}</strong>
            </span>
            <span>
              {t("payments.totalOutstanding")}{" "}
              <strong dir="ltr" className="text-danger-700">
                {formatMoney((totals.due - totals.paid).toFixed(3), locale)}
              </strong>
            </span>
          </div>

          <Table columns={columns} rows={rows} getRowKey={(row) => row.id} />
        </>
      )}

      {query.data !== undefined && query.data.total_pages > 1 && (
        <div className="mt-6">
          <Pagination
            page={query.data.page}
            totalPages={query.data.total_pages}
            count={query.data.count}
            countLabel={t("payments.invoiceCount", { count: query.data.count })}
            onChange={setPage}
          />
        </div>
      )}

      {/* Keyed per invoice so the amount defaults freshly each time. */}
      {paying !== null && (
        <RecordPaymentModal
          key={paying.id}
          invoice={paying}
          onClose={() => setPaying(null)}
        />
      )}
    </PageShell>
  );
}
