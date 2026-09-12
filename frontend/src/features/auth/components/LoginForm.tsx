import { KeyRound, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Alert, Button, Input } from "@/components/ui";

import { useLoginForm } from "../useLoginForm";

export function LoginForm({ area }: { area: "parent" | "staff" }) {
  const { t } = useTranslation();
  const { form, onSubmit, formError } = useLoginForm(area);
  const { errors, isSubmitting } = form.formState;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError !== null && <Alert tone="danger">{formError}</Alert>}

      <Input
        label={t("form.email")}
        type="email"
        autoComplete="email"
        autoFocus
        placeholder={t("form.emailPlaceholder")}
        leftIcon={<Mail className="size-4" />}
        error={errors.email?.message}
        {...form.register("email")}
      />

      <Input
        label={t("form.password")}
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        leftIcon={<KeyRound className="size-4" />}
        error={errors.password?.message}
        {...form.register("password")}
      />

      <Button type="submit" fullWidth size="lg" isLoading={isSubmitting}>
        {t("auth.signIn")}
      </Button>
    </form>
  );
}
