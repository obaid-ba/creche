import { Baby, Moon, Smile, Thermometer, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const { feeding, sleep, health, hygiene, mood } = summary;

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
      <SummaryCard
        icon={UtensilsCrossed}
        label={t("summary.meals")}
        value={String(feeding.meals + feeding.bottles)}
        detail={
          feeding.bottles > 0
            ? t("summary.bottles", {
                count: feeding.bottles,
                ml: feeding.total_ml,
              })
            : t("summary.mealCount", { count: feeding.meals })
        }
        tone="bg-accent-100 text-accent-500"
      />

      <SummaryCard
        icon={Moon}
        label={t("summary.sleep")}
        value={sleep.total_display}
        detail={
          sleep.in_progress
            ? t("summary.napInProgress")
            : t("summary.naps", { count: sleep.naps })
        }
        tone="bg-secondary-100 text-secondary-700"
      />

      <SummaryCard
        icon={Thermometer}
        label={t("summary.temperature")}
        value={
          health.last_temperature !== null
            ? `${String(health.last_temperature).replace(".", ",")} °C`
            : "—"
        }
        detail={
          health.temperature_count > 0
            ? t("summary.measurements", { count: health.temperature_count })
            : t("summary.noMeasurement")
        }
        tone="bg-info-50 text-info-700"
      />

      <SummaryCard
        icon={Baby}
        label={t("summary.hygiene")}
        value={String(hygiene.diaper_changes + hygiene.toilet_visits)}
        detail={
          hygiene.toilet_visits > 0
            ? t("summary.changesAndToilet", {
                changes: hygiene.diaper_changes,
                toilet: hygiene.toilet_visits,
              })
            : t("summary.changes", { count: hygiene.diaper_changes })
        }
        tone="bg-success-50 text-success-700"
      />

      <SummaryCard
        icon={Smile}
        label={t("summary.mood")}
        value={mood.latest_label ?? "—"}
        detail={
          mood.observations > 0
            ? t("summary.observations", { count: mood.observations })
            : t("summary.noObservation")
        }
        tone="bg-primary-100 text-primary-700"
      />
    </div>
  );
}
