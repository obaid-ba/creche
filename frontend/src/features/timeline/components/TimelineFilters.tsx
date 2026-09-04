import { cn } from "@/lib/cn";

import type { TimelineFilter } from "../types";

/** Chips from the brief (11); labels come from the server registry. */
export function TimelineFilters({
  value,
  onChange,
  options,
}: {
  value: TimelineFilter;
  onChange: (filter: TimelineFilter) => void;
  options: { key: string; label: string }[];
}) {
  const chips = [{ key: "all", label: "Tout" }, ...options];

  return (
    <div
      role="group"
      aria-label="Filtrer les événements"
      className="flex flex-wrap gap-2"
    >
      {chips.map((chip) => {
        const isActive = value === chip.key;
        return (
          <button
            key={chip.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(chip.key as TimelineFilter)}
            className={cn(
              "rounded-pill px-3.5 py-1.5 text-sm font-semibold transition-colors",
              isActive
                ? "bg-primary-500 text-white"
                : "bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50",
            )}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
