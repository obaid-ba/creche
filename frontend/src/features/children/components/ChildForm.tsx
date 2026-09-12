import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Alert, Button, Input, Select } from "@/components/ui";
import { ApiError } from "@/services/errors";

import { childSchema, type ChildFormValues } from "../schemas";
import type { ChildDetail } from "../types";

const GENDERS = [
  { value: "", key: "child.genderUnspecified" },
  { value: "M", key: "child.boy" },
  { value: "F", key: "child.girl" },
  { value: "OTHER", key: "child.genderOther" },
] as const;

export function ChildForm({
  child,
  onSubmit,
  submitLabel,
}: {
  child?: ChildDetail;
  onSubmit: (values: ChildFormValues) => Promise<unknown>;
  submitLabel: string;
}) {
  const { t } = useTranslation();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ChildFormValues>({
    resolver: zodResolver(childSchema),
    defaultValues: {
      first_name: child?.first_name ?? "",
      last_name: child?.last_name ?? "",
      date_of_birth: child?.date_of_birth ?? "",
      gender: child?.gender ?? "",
      registration_date: child?.registration_date ?? "",
      allergies: child?.allergies ?? "",
      medical_notes: child?.medical_notes ?? "",
      notes: child?.notes ?? "",
    },
  });

  const { errors, isSubmitting } = form.formState;

  const handleSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSubmit(values);
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
        if (field in childSchema.shape) {
          form.setError(field as keyof ChildFormValues, {
            message: messages[0] ?? "",
          });
        }
      }
      setFormError(apiError.message);
    }
  });

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formError !== null && <Alert tone="danger">{formError}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t("form.firstName")}
          autoComplete="off"
          error={errors.first_name?.message}
          {...form.register("first_name")}
        />
        <Input
          label={t("form.lastName")}
          autoComplete="off"
          error={errors.last_name?.message}
          {...form.register("last_name")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t("child.birthDate")}
          type="date"
          hint={t("child.birthDateHint")}
          error={errors.date_of_birth?.message}
          {...form.register("date_of_birth")}
        />

        <Select
          label={t("child.gender")}
          options={GENDERS.map((g) => ({ value: g.value, label: t(g.key) }))}
          {...form.register("gender")}
        />
      </div>

      <Input
        label={t("child.registrationDate")}
        type="date"
        error={errors.registration_date?.message}
        {...form.register("registration_date")}
      />

      <div>
        <label
          htmlFor="allergies"
          className="mb-1.5 block text-sm font-semibold text-ink-700"
        >
          {t("child.allergiesField")}
        </label>
        <textarea
          id="allergies"
          rows={2}
          placeholder={t("child.allergiesPlaceholder")}
          className="w-full rounded-card border border-ink-200 bg-shell px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
          {...form.register("allergies")}
        />
        <p className="mt-1.5 text-xs text-ink-500">
          {t("child.allergiesHint")}
        </p>
      </div>

      <div>
        <label
          htmlFor="medical_notes"
          className="mb-1.5 block text-sm font-semibold text-ink-700"
        >
          {t("child.medicalNotes")}
        </label>
        <textarea
          id="medical_notes"
          rows={3}
          className="w-full rounded-card border border-ink-200 bg-shell px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
          {...form.register("medical_notes")}
        />
        <p className="mt-1.5 text-xs text-ink-500">{t("child.medicalHint")}</p>
      </div>

      <div>
        <label
          htmlFor="notes"
          className="mb-1.5 block text-sm font-semibold text-ink-700"
        >
          {t("child.internalNotes")}
        </label>
        <textarea
          id="notes"
          rows={3}
          className="w-full rounded-card border border-ink-200 bg-shell px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
          {...form.register("notes")}
        />
      </div>

      <Button type="submit" size="lg" isLoading={isSubmitting}>
        {submitLabel}
      </Button>
    </form>
  );
}
