import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui";
import i18n from "@/i18n/config";
import { currentLanguage } from "@/i18n/useDirection";
import { cn } from "@/lib/cn";

/** Local YYYY-MM-DD; toISOString would shift the day across timezones. */
export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

function shiftDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** "Aujourd'hui", "Hier", or the date written out in full.
 *
 *  Reads the active language from the i18next instance rather than
 *  taking it as an argument: this is exported and called from tests and
 *  from render, and threading a locale through every caller buys
 *  nothing when react-i18next already re-renders on a switch. */
export function describeDate(iso: string): string {
  const today = todayISO();
  if (iso === today) return i18n.t("timeline.today");
  if (iso === shiftDays(today, -1)) return i18n.t("timeline.yesterday");

  const locale = currentLanguage(i18n.language) === "ar" ? "ar-TN" : "fr-FR";
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1).toLocaleDateString(
    locale,
    { weekday: "long", day: "numeric", month: "long" },
  );
}

export function DateSelector({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (date: string) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const isToday = value === todayISO();

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button
        variant="outline"
        size="sm"
        aria-label={t("timeline.previousDay")}
        onClick={() => onChange(shiftDays(value, -1))}
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
      </Button>

      <div className="min-w-40 text-center">
        <p className="font-bold capitalize text-ink-900" aria-live="polite">
          {describeDate(value)}
        </p>
      </div>

      <Button
        variant="outline"
        size="sm"
        aria-label={t("timeline.nextDay")}
        // A nursery day cannot be in the future, so forward stops at today.
        disabled={isToday}
        onClick={() => onChange(shiftDays(value, 1))}
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </Button>

      <label className="sr-only" htmlFor="timeline-date">
        {t("timeline.chooseDate")}
      </label>
      <input
        id="timeline-date"
        type="date"
        value={value}
        max={todayISO()}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-card border border-ink-200 bg-shell px-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
      />

      {!isToday && (
        <Button variant="ghost" size="sm" onClick={() => onChange(todayISO())}>
          {t("timeline.today")}
        </Button>
      )}
    </div>
  );
}
