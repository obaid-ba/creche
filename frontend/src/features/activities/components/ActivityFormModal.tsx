import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, Button, Input, Modal, Select } from "@/components/ui";
import { ApiError } from "@/services/errors";

import { CATEGORY_LABELS, type Activity } from "../types";

const schema = z
  .object({
    title: z.string().trim().min(1, "Le titre est requis.").max(120),
    description: z.string().optional(),
    date: z
      .string()
      .min(1, "La date est requise.")
      .refine((value) => {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        return new Date(value) <= today;
      }, "Une activité ne peut pas être datée dans le futur."),
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
    { message: "La fin ne peut pas précéder le début.", path: ["end_time"] },
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
              message: "Une erreur inattendue est survenue.",
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
      title={activity !== undefined ? "Modifier l'activité" : "Nouvelle activité"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => void submit()} isLoading={isSubmitting}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {formError !== null && <Alert tone="danger">{formError}</Alert>}

        <Input
          label="Titre"
          autoFocus
          placeholder="Atelier peinture"
          error={errors.title?.message}
          {...form.register("title")}
        />

        <Select
          label={"Catégorie"}
          options={Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))}
          {...form.register("category")}
        />

        <Input
          label="Date"
          type="date"
          error={errors.date?.message}
          {...form.register("date")}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Début"
            type="time"
            error={errors.start_time?.message}
            {...form.register("start_time")}
          />
          <Input
            label="Fin"
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
            Description
          </label>
          <textarea
            id="activity-description"
            rows={3}
            className="w-full rounded-card border border-ink-200 bg-white px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
            {...form.register("description")}
          />
        </div>
      </div>
    </Modal>
  );
}
