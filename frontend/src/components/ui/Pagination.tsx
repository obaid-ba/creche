import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "./Button";

/**
 * `countLabel` rather than a hard-coded noun: this used to say "enfant"
 * regardless of what was being paged, so the parents list read "12
 * enfants" and the complaints list did too.
 */
export function Pagination({
  page,
  totalPages,
  count,
  countLabel,
  onChange,
}: {
  page: number;
  totalPages: number;
  count: number;
  countLabel?: string;
  onChange: (page: number) => void;
}) {
  const { t } = useTranslation();

  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label={t("ui.pagination")}
      className="flex flex-wrap items-center justify-between gap-4 border-t border-ink-100 pt-4"
    >
      <p className="text-sm text-ink-500" aria-live="polite">
        {t("ui.pageOf", { page, total: totalPages })} ·{" "}
        {countLabel ?? t("ui.result", { count })}
      </p>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          leftIcon={<ChevronLeft className="size-4" />}
        >
          {t("ui.previous")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          rightIcon={<ChevronRight className="size-4" />}
        >
          {t("ui.next")}
        </Button>
      </div>
    </nav>
  );
}
