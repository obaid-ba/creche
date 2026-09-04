import { Baby, Moon, Smile, Thermometer, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card, CardBody } from "@/components/ui";
import type { DailySummary } from "@/features/timeline/types";

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
  tone: string;
}) {
  return (
    <Card>
      {/* Icon sits beside the label on phones and above it from sm up:
          five stacked full-width cards pushed the timeline - the thing a
          parent opens the app for - almost two screens down. */}
      <CardBody className="p-3 sm:p-4">
        <div className="flex items-center gap-2 sm:block">
          <span
            className={`grid size-8 shrink-0 place-items-center rounded-card sm:size-9 ${tone}`}
          >
            <Icon aria-hidden="true" className="size-4" />
          </span>
          <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-ink-400 sm:mt-3 sm:text-xs">
            {label}
          </p>
        </div>
        <p className="mt-1 text-lg font-bold text-ink-900 sm:mt-0.5 sm:text-xl">
          {value}
        </p>
        {detail !== undefined && detail !== "" && (
          <p className="mt-0.5 text-xs text-ink-500 sm:text-sm">{detail}</p>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * "Situation de l'enfant" at a glance.
 *
 * Every figure here is aggregated from the same events the timeline
 * renders, so the two views cannot disagree (docs/timeline.md 3.1).
 */
export function DailySummaryCards({ summary }: { summary: DailySummary }) {
  const { feeding, sleep, health, hygiene, mood } = summary;

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
      <SummaryCard
        icon={UtensilsCrossed}
        label="Repas"
        value={String(feeding.meals + feeding.bottles)}
        detail={
          feeding.bottles > 0
            ? `${feeding.bottles} biberon${feeding.bottles > 1 ? "s" : ""} · ${feeding.total_ml} ml`
            : `${feeding.meals} repas`
        }
        tone="bg-accent-100 text-accent-500"
      />

      <SummaryCard
        icon={Moon}
        label="Sommeil"
        value={sleep.total_display}
        detail={
          sleep.in_progress
            ? "Sieste en cours"
            : `${sleep.naps} sieste${sleep.naps > 1 ? "s" : ""}`
        }
        tone="bg-secondary-100 text-secondary-700"
      />

      <SummaryCard
        icon={Thermometer}
        label="Température"
        value={
          health.last_temperature !== null
            ? `${String(health.last_temperature).replace(".", ",")} °C`
            : "—"
        }
        detail={
          health.temperature_count > 0
            ? `${health.temperature_count} mesure${health.temperature_count > 1 ? "s" : ""}`
            : "Aucune mesure"
        }
        tone="bg-info-50 text-info-700"
      />

      <SummaryCard
        icon={Baby}
        label="Hygiène"
        value={String(hygiene.diaper_changes + hygiene.toilet_visits)}
        detail={
          hygiene.toilet_visits > 0
            ? `${hygiene.diaper_changes} change(s) · ${hygiene.toilet_visits} toilettes`
            : `${hygiene.diaper_changes} change${hygiene.diaper_changes > 1 ? "s" : ""}`
        }
        tone="bg-success-50 text-success-700"
      />

      <SummaryCard
        icon={Smile}
        label="Humeur"
        value={mood.latest_label ?? "—"}
        detail={
          mood.observations > 0
            ? `${mood.observations} observation${mood.observations > 1 ? "s" : ""}`
            : "Aucune observation"
        }
        tone="bg-primary-100 text-primary-700"
      />
    </div>
  );
}
