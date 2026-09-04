import { Palette, Plus } from "lucide-react";
import { useState } from "react";

import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Pagination,
} from "@/components/ui";
import { ActivityCard } from "@/features/activities/components/ActivityCard";
import { ActivityFormModal } from "@/features/activities/components/ActivityFormModal";
import { useActivities, useCreateActivity } from "@/features/activities/hooks";
import { CATEGORY_LABELS } from "@/features/activities/types";

export function StaffActivitiesPage() {
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);

  const query = useActivities({ page, category });
  const createActivity = useCreateActivity();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Activités</h1>
          <p className="mt-1 text-sm text-ink-500">
            {query.data?.count ?? 0} activité
            {(query.data?.count ?? 0) === 1 ? "" : "s"}
          </p>
        </div>

        <Button
          leftIcon={<Plus className="size-4" />}
          onClick={() => setIsFormOpen(true)}
        >
          Nouvelle activité
        </Button>
      </div>

      <div className="mb-6">
        <label
          htmlFor="filter-category"
          className="mb-1.5 block text-sm font-semibold text-ink-700"
        >
          Catégorie
        </label>
        <select
          id="filter-category"
          value={category}
          onChange={(event) => {
            setPage(1);
            setCategory(event.target.value);
          }}
          className="h-11 rounded-card border border-ink-200 bg-white px-3 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
        >
          <option value="">Toutes les catégories</option>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

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
          description="Créez la première activité de la crèche."
          action={
            <Button size="sm" onClick={() => setIsFormOpen(true)}>
              Nouvelle activité
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {query.data.results.map((activity) => (
            <li key={activity.id}>
              <ActivityCard activity={activity} />
            </li>
          ))}
        </ul>
      )}

      {query.data !== undefined && (
        <div className="mt-6">
          <Pagination
            page={query.data.page}
            totalPages={query.data.total_pages}
            count={query.data.count}
            onChange={setPage}
          />
        </div>
      )}

      <ActivityFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={async (values) => {
          await createActivity.mutateAsync({
            title: values.title,
            description: values.description,
            date: values.date,
            start_time: values.start_time === "" ? null : values.start_time,
            end_time: values.end_time === "" ? null : values.end_time,
            category: values.category as never,
          });
        }}
      />
    </div>
  );
}
