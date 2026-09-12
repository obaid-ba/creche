import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Mail, User } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { Alert, Button, Input, Select } from "@/components/ui";
import { ApiError } from "@/services/errors";

import { claimSchema, type ClaimFormValues } from "../schemas";
import { useAuth } from "../useAuth";

/** Values are the API's enum; the wording comes from the locale files. */
const RELATIONSHIPS = [
  { value: "MOTHER", key: "form.mother" },
  { value: "FATHER", key: "form.father" },
  { value: "GUARDIAN", key: "form.guardian" },
  { value: "OTHER", key: "form.other" },
] as const;

/** Fields the backend may report that map onto this form. */
const MAPPED_FIELDS = new Set<keyof ClaimFormValues>([
  "access_code",
  "email",
  "password",
  "first_name",
  "last_name",
  "phone",
]);

export function ClaimForm() {
  const { t } = useTranslation();
  const { claim } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ClaimFormValues>({
    resolver: zodResolver(claimSchema),
    defaultValues: {
      access_code: "",
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      relationship: "MOTHER",
      password: "",
      password_confirm: "",
    },
  });

  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      // password_confirm is a client-side check only; it is not sent.
      const { password_confirm: _unused, ...payload } = values;
      await claim(payload);
      navigate("/parent", { replace: true });
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
        if (MAPPED_FIELDS.has(field as keyof ClaimFormValues)) {
          form.setError(field as keyof ClaimFormValues, {
            message: messages[0] ?? "",
          });
        }
      }
      setFormError(apiError.message);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError !== null && <Alert tone="danger">{formError}</Alert>}

      <Input
        label={t("form.accessCode")}
        placeholder="MAM-XXXXX"
        autoFocus
        autoComplete="off"
        spellCheck={false}
        // The code is issued in Latin letters and digits whatever the
        // interface language, so the field stays left-to-right.
        dir="ltr"
        hint={t("form.accessCodeHint")}
        leftIcon={<KeyRound className="size-4" />}
        error={errors.access_code?.message}
        {...form.register("access_code")}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t("form.firstName")}
          autoComplete="given-name"
          leftIcon={<User className="size-4" />}
          error={errors.first_name?.message}
          {...form.register("first_name")}
        />
        <Input
          label={t("form.lastName")}
          autoComplete="family-name"
          error={errors.last_name?.message}
          {...form.register("last_name")}
        />
      </div>

        <Select
          label={t("form.relationship")}
          options={RELATIONSHIPS.map((r) => ({
            value: r.value,
            label: t(r.key),
          }))}
          {...form.register("relationship")}
        />

      <Input
        label={t("form.email")}
        type="email"
        autoComplete="email"
        leftIcon={<Mail className="size-4" />}
        error={errors.email?.message}
        {...form.register("email")}
      />

      <Input
        label={t("form.phoneOptional")}
        type="tel"
        autoComplete="tel"
        dir="ltr"
        error={errors.phone?.message}
        {...form.register("phone")}
      />

      <Input
        label={t("form.password")}
        type="password"
        autoComplete="new-password"
        hint={t("form.passwordHint")}
        error={errors.password?.message}
        {...form.register("password")}
      />

      <Input
        label={t("form.passwordConfirm")}
        type="password"
        autoComplete="new-password"
        error={errors.password_confirm?.message}
        {...form.register("password_confirm")}
      />

      <Button type="submit" fullWidth size="lg" isLoading={isSubmitting}>
        {t("form.activate")}
      </Button>
    </form>
  );
}
