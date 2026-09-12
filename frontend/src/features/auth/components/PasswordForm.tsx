import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Alert, Button, Input } from "@/components/ui";
import { ApiError } from "@/services/errors";

import { profileApi } from "../profileApi";

interface Values {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export function PasswordForm({ onChanged }: { onChanged?: () => void }) {
  const { t } = useTranslation();
  const [formError, setFormError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const form = useForm<Values>({
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    setIsDone(false);

    if (values.new_password !== values.confirm_password) {
      form.setError("confirm_password", {
        message: "Les mots de passe ne correspondent pas.",
      });
      return;
    }

    try {
      // password_confirm is a client-side check only; it is not sent.
      await profileApi.changePassword({
        current_password: values.current_password,
        new_password: values.new_password,
      });
      form.reset();
      setIsDone(true);
      onChanged?.();
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
        if (field === "current_password" || field === "new_password") {
          form.setError(field, { message: messages[0] ?? "" });
        }
      }
      setFormError(apiError.message);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {formError !== null && <Alert tone="danger">{formError}</Alert>}
      {isDone && (
        <Alert tone="success">
          Mot de passe modifié. Vous devrez peut-être vous reconnecter.
        </Alert>
      )}

      <Input
        label={t("password.current")}
        type="password"
        autoComplete="current-password"
        error={errors.current_password?.message}
        {...form.register("current_password", { required: "settings.required" })}
      />
      <Input
        label={t("password.new")}
        type="password"
        autoComplete="new-password"
        hint={t("form.passwordHint")}
        error={errors.new_password?.message}
        {...form.register("new_password", { required: "settings.required" })}
      />
      <Input
        label={t("password.confirm")}
        type="password"
        autoComplete="new-password"
        error={errors.confirm_password?.message}
        {...form.register("confirm_password", { required: "settings.required" })}
      />

      <Button type="submit" variant="outline" isLoading={isSubmitting}>
        {t("password.change")}
      </Button>
    </form>
  );
}
