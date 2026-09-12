import { Palette } from "lucide-react";
import { useTranslation } from "react-i18next";

import { PageShell } from "@/components/app";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { ActivityCard } from "@/features/activities/components/ActivityCard";
import { useActivities } from "@/features/activities/hooks";

/**
 * Activities a parent's own child took part in.
 *
 * The scope is derived server-side from guardianship, so this page never
 * sends a child id (docs/api.md 8).
 */
export function ParentActivitiesPage() {
  const { t } = useTranslation();
  const query = useActivities({});

  return (
    <PageShell size="form">
      <h1 className="font-display text-2xl font-extrabold text-secondary-900 sm:text-[1.75rem]">
        {t("activities.pageTitle")}
      </h1>
      <p className="mt-1 text-sm text-ink-500">{t("activities.parentLead")}</p>

      <div className="mt-6">
        {query.isPending ? (
          <LoadingState label={t("activities.loading")} />
        ) : query.isError ? (
          <ErrorState
            description={t("activities.loadError")}
            onRetry={() => void query.refetch()}
          />
        ) : query.data.results.length === 0 ? (
          <EmptyState
            icon={<Palette className="size-6" />}
            title={t("activities.empty")}
            description={t("activities.parentEmptyHint")}
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {query.data.results.map((activity) => (
              <li key={activity.id}>
                <ActivityCard activity={activity} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
