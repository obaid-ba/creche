import { Palette } from "lucide-react";

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
  const query = useActivities({});

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold">Activités</h1>
      <p className="mt-1 text-sm text-ink-500">
        Les activités auxquelles votre enfant a participé.
      </p>

      <div className="mt-6">
        {query.isPending ? (
          <LoadingState label="Chargement des activités…" />
        ) : query.isError ? (
          <ErrorState
            description="Impossible de charger les activités."
            onRetry={() => void query.refetch()}
          />
        ) : query.data.results.length === 0 ? (
          <EmptyState
            icon={<Palette className="size-6" />}
            title="Aucune activité"
            description="Les activités apparaîtront ici dès que votre enfant y participera."
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
    </div>
  );
}
