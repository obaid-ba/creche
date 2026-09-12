import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { Alert, Button, Input, Modal, Select } from "@/components/ui";
import { ApiError } from "@/services/errors";

import { CATEGORY_KEYS, type Activity } from "../types";

const schema = z
  .object({
    title: z.string().trim().min(1, "validation.titleRequired").max(120),
    description: z.string().optional(),
    date: z
      .string()
      .min(1, "validation.dateRequired")
      .refine((value) => {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        return new Date(value) <= today;
      }, "validation.activityFuture"),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    category: z.string(),
  })
  .refine(
    (v) =>
      v.start_time === undefined ||
      v.end_time === undefined ||
      v.start_time === "" ||
      v.end_time === "" ||
      v.end_time >= v.start_time,
    { message: "validation.endBeforeStart", path: ["end_time"] },
  );

type FormValues = z.infer<typeof schema>;

export function ActivityFormModal({
  isOpen,
  onClose,
  activity,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  activity?: Activity;
  onSubmit: (values: FormValues) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: activity?.title ?? "",
      description: activity?.description ?? "",
      date: activity?.date ?? new Date().toISOString().slice(0, 10),
      start_time: activity?.start_time?.slice(0, 5) ?? "",
      end_time: activity?.end_time?.slice(0, 5) ?? "",
      category: activity?.category ?? "ART",
    },
  });

  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSubmit(values);
      form.reset();
      onClose();
    } catch (error) {
      const apiError =
        error instanceof ApiError
          ? error
          : new ApiError({
              code: "unknown",
              message: t("validation.unexpected"),
              status: 0,
            });
      for (const [field, messages] of Object.entries(apiError.fieldErrors)) {
        if (field in schema._def.schema.shape) {
          form.setError(field as keyof FormValues, { message: messages[0] ?? "" });
        }
      }
      setFormError(apiError.message);
    }
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t(activity !== undefined ? "activities.edit" : "activities.new")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void submit()} isLoading={isSubmitting}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {formError !== null && <Alert tone="danger">{formError}</Alert>}

        <Input
          label={t("activities.fieldTitle")}
          autoFocus
          placeholder={t("activities.titlePlaceholder")}
          error={errors.title?.message}
          {...form.register("title")}
        />

        <Select
          label={t("activities.category")}
          options={Object.entries(CATEGORY_KEYS).map(([value, key]) => ({
            value,
            label: t(key),
          }))}
          {...form.register("category")}
        />

        <Input
          label={t("activities.date")}
          type="date"
          error={errors.date?.message}
          {...form.register("date")}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t("activities.start")}
            type="time"
            error={errors.start_time?.message}
            {...form.register("start_time")}
          />
          <Input
            label={t("activities.end")}
            type="time"
            error={errors.end_time?.message}
            {...form.register("end_time")}
          />
        </div>

        <div>
          <label
            htmlFor="activity-description"
            className="mb-1.5 block text-sm font-semibold text-ink-700"
          >
            {t("activities.description")}
          </label>
          <textarea
            id="activity-description"
            rows={3}
            className="w-full rounded-card border border-ink-200 bg-shell px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
            {...form.register("description")}
          />
        </div>
      </div>
    </Modal>
  );
}
