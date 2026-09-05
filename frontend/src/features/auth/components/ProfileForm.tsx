import { useState } from "react";
import { useForm } from "react-hook-form";

import { Alert, Button, Input } from "@/components/ui";
import { ApiError } from "@/services/errors";
import type { CurrentUser } from "@/types/api";

import { profileApi, type ProfileInput } from "../profileApi";

export function ProfileForm({
  user,
  onSaved,
}: {
  user: CurrentUser;
  onSaved: () => Promise<void> | void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  const isParent = user.role === "PARENT";

  const form = useForm<ProfileInput>({
    defaultValues: {
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      ...(isParent
        ? {
            address: user.address ?? "",
            emergency_phone: user.emergency_phone ?? "",
          }
        : {}),
    },
  });

  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    setIsSaved(false);
    try {
      await profileApi.update(values);
      await onSaved();
      setIsSaved(true);
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
        form.setError(field as keyof ProfileInput, { message: messages[0] ?? "" });
      }
      setFormError(apiError.message);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {formError !== null && <Alert tone="danger">{formError}</Alert>}
      {isSaved && <Alert tone="success">Vos informations ont été enregistrées.</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Prénom"
          autoComplete="given-name"
          error={errors.first_name?.message}
          {...form.register("first_name", { required: "Le prénom est requis." })}
        />
        <Input
          label="Nom"
          autoComplete="family-name"
          error={errors.last_name?.message}
          {...form.register("last_name", { required: "Le nom est requis." })}
        />
      </div>

      <Input
        label="Adresse e-mail"
        value={user.email}
        readOnly
        disabled
        hint="Contactez la crèche pour changer votre adresse e-mail."
      />

      <Input
        label="Téléphone"
        type="tel"
        autoComplete="tel"
        error={errors.phone?.message}
        {...form.register("phone")}
      />

      {isParent && (
        <>
          <Input
            label="Téléphone d'urgence"
            type="tel"
            hint="Une deuxième personne à joindre si vous êtes injoignable."
            error={errors.emergency_phone?.message}
            {...form.register("emergency_phone")}
          />

          <div>
            <label
              htmlFor="address"
              className="mb-1.5 block text-sm font-semibold text-ink-700"
            >
              Adresse
            </label>
            <textarea
              id="address"
              rows={3}
              className="w-full rounded-card border border-ink-200 bg-white px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
              {...form.register("address")}
            />
          </div>
        </>
      )}

      <Button type="submit" isLoading={isSubmitting}>
        Enregistrer
      </Button>
    </form>
  );
}
