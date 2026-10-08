import { Palette, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PageShell } from "@/components/app";
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Drawer,
  Modal,
  Pagination,
  Select,
} from "@/components/ui";
import { ActivityCard } from "@/features/activities/components/ActivityCard";
import { ActivityFormModal } from "@/features/activities/components/ActivityFormModal";
import { ActivityParticipants } from "@/features/activities/components/ActivityParticipants";
import { ActivityPhotos } from "@/features/activities/components/ActivityPhotos";
import {
  useActivities,
  useCreateActivity,
  useDeleteActivity,
  useUpdateActivity,
} from "@/features/activities/hooks";
import { CATEGORY_KEYS, type Activity } from "@/features/activities/types";

export function StaffActivitiesPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  // null = closed, "new" = creating, an Activity = editing that one.
  const [form, setForm] = useState<Activity | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Activity | null>(null);

  const query = useActivities({ page, category });
  const createActivity = useCreateActivity();
  const deleteActivity = useDeleteActivity();
  // The hook takes its id up front, so it is bound to whichever activity
  // the form currently holds. Empty while creating, when it is unused.
  const updateActivity = useUpdateActivity(
    form !== null && form !== "new" ? form.id : "",
  );

  // Derived once. The drawer used to re-run this find() three times, and
  // the list row already carries participants and photos, so there is
  // nothing a detail fetch would add.
  const open = query.data?.results.find((a) => a.id === openId) ?? null;

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
          onClick={() => setForm("new")}
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
            <Button size="sm" onClick={() => setForm("new")}>
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
                onClick={() => setOpenId(activity.id)}
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
        isOpen={open !== null}
        onClose={() => setOpenId(null)}
        title={open?.title ?? t("activities.fallbackTitle")}
        {...(open === null ? {} : { description: open.category_label })}
      >
        {open !== null && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Pencil className="size-4" />}
                onClick={() => setForm(open)}
              >
                {t("common.edit")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Trash2 className="size-4" />}
                onClick={() => setConfirmDelete(open)}
              >
                {t("common.delete")}
              </Button>
            </div>

            <ActivityParticipants
              activityId={open.id}
              participants={open.participants ?? []}
            />

            <section className="border-t border-ink-100 pt-4">
              <h3 className="mb-3 text-sm font-bold text-ink-900">
                {t("activities.photos")}
              </h3>
              <ActivityPhotos
                activityId={open.id}
                photos={open.photos}
                canEdit
                onChanged={() => void query.refetch()}
              />
            </section>
          </div>
        )}
      </Drawer>

      {/* Keyed so switching between "new" and a particular activity
          remounts the form: react-hook-form captures defaultValues once,
          so a shared instance would keep showing the first activity's
          values. */}
      {form !== null && (
        <ActivityFormModal
          key={form === "new" ? "new" : form.id}
          isOpen
          onClose={() => setForm(null)}
          {...(form === "new" ? {} : { activity: form })}
          onSubmit={async (values) => {
            const input = {
              title: values.title,
              description: values.description,
              date: values.date,
              start_time: values.start_time === "" ? null : values.start_time,
              end_time: values.end_time === "" ? null : values.end_time,
              category: values.category as never,
            };
            if (form === "new") await createActivity.mutateAsync(input);
            else await updateActivity.mutateAsync(input);
          }}
        />
      )}

      <Modal
        isOpen={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={t("activities.deleteTitle")}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              isLoading={deleteActivity.isPending}
              onClick={() => {
                if (confirmDelete === null) return;
                // mutate, not mutateAsync: the error is rendered from
                // isError below, and a rejected mutateAsync here would
                // escape as an unhandled rejection.
                deleteActivity.mutate(confirmDelete.id, {
                  onSuccess: () => {
                    setConfirmDelete(null);
                    setOpenId(null);
                  },
                });
              }}
            >
              {t("common.delete")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          {t("activities.deleteWarning", {
            count: confirmDelete?.participant_count ?? 0,
          })}
        </p>
        {deleteActivity.isError && (
          <Alert tone="danger" className="mt-3">
            {t("activities.deleteFailed")}
          </Alert>
        )}
      </Modal>

    </PageShell>
  );
}
