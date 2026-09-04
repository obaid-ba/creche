import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui";
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

/** "Aujourd'hui", "Hier", or a full French date. */
export function describeDate(iso: string): string {
  const today = todayISO();
  if (iso === today) return "Aujourd'hui";
  if (iso === shiftDays(today, -1)) return "Hier";

  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1).toLocaleDateString(
    "fr-FR",
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
  const isToday = value === todayISO();

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button
        variant="outline"
        size="sm"
        aria-label="Jour précédent"
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
        aria-label="Jour suivant"
        // A nursery day cannot be in the future, so forward stops at today.
        disabled={isToday}
        onClick={() => onChange(shiftDays(value, 1))}
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </Button>

      <label className="sr-only" htmlFor="timeline-date">
        Choisir une date
      </label>
      <input
        id="timeline-date"
        type="date"
        value={value}
        max={todayISO()}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-card border border-ink-200 bg-white px-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
      />

      {!isToday && (
        <Button variant="ghost" size="sm" onClick={() => onChange(todayISO())}>
          Aujourd'hui
        </Button>
      )}
    </div>
  );
}
