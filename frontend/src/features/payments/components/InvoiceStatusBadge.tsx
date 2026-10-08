import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui";

import { STATUS_KEYS, type InvoiceStatus } from "../types";

/** Overdue is the only one that should catch the eye. */
const TONES: Record<InvoiceStatus, "success" | "warning" | "danger" | "neutral"> = {
  PAID: "success",
  PARTIAL: "warning",
  OVERDUE: "danger",
  UNPAID: "neutral",
  CANCELLED: "neutral",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { t } = useTranslation();
  return <Badge tone={TONES[status]}>{t(STATUS_KEYS[status])}</Badge>;
}
