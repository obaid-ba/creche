import { Palette, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PageShell } from "@/components/app";
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Drawer,
  Pagination,
  Select,
} from "@/components/ui";
import { ActivityCard } from "@/features/activities/components/ActivityCard";
import { ActivityFormModal } from "@/features/activities/components/ActivityFormModal";
import { ActivityPhotos } from "@/features/activities/components/ActivityPhotos";
import { useActivities, useCreateActivity } from "@/features/activities/hooks";
import { CATEGORY_KEYS } from "@/features/activities/types";

export function StaffActivitiesPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [openActivityId, setOpenActivityId] = useState<string | null>(null);

  const query = useActivities({ page, category });
  const createActivity = useCreateActivity();

  return (
    <PageShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-secondary-900 sm:text-[1.75rem]">
            {t("activities.pageTitle")}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {t("activities.count", { count: query.data?.count ?? 0 })}
          </p>
        </div>

        <Button
          leftIcon={<Plus className="size-4" />}
          onClick={() => setIsFormOpen(true)}
        >
          {t("activities.new")}
        </Button>
      </div>

      <div className="mb-6 w-64">
        <Select
          label={t("activities.category")}
          value={category}
          placeholder={t("activities.allCategories")}
          options={Object.entries(CATEGORY_KEYS).map(([value, key]) => ({
            value,
            label: t(key),
          }))}
          onChange={(event) => {
            setPage(1);
            setCategory(event.target.value);
          }}
        />
      </div>

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
          description={t("activities.staffEmptyHint")}
          action={
            <Button size="sm" onClick={() => setIsFormOpen(true)}>
              {t("activities.new")}
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {query.data.results.map((activity) => (
            <li key={activity.id}>
              <ActivityCard
                activity={activity}
                onClick={() => setOpenActivityId(activity.id)}
              />
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
            countLabel={t("activities.count", { count: query.data.count })}
            onChange={setPage}
          />
        </div>
      )}

      <Drawer
        isOpen={openActivityId !== null}
        onClose={() => setOpenActivityId(null)}
        title={
          query.data?.results.find((a) => a.id === openActivityId)?.title ??
          t("activities.fallbackTitle")
        }
        description={t("activities.photos")}
      >
        {openActivityId !== null && (
          <ActivityPhotos
            activityId={openActivityId}
            photos={
              query.data?.results.find((a) => a.id === openActivityId)?.photos ?? []
            }
            canEdit
            onChanged={() => void query.refetch()}
          />
        )}
      </Drawer>

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
    </PageShell>
  );
}
