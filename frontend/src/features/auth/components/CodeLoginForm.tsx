import { zodResolver } from "@hookform/resolvers/zod";
import { Baby, KeyRound } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { Alert, Button, Input } from "@/components/ui";
import { ApiError } from "@/services/errors";

import { codeLoginSchema, type CodeLoginFormValues } from "../schemas";
import { useAuth } from "../useAuth";

/**
 * The parent's only sign-in.
 *
 * There is no password and no registration: staff create the account from
 * the paper enrolment form, and the family leaves with a code. Two fields
 * is the whole of it, which is the point — this is used by people holding
 * a toddler.
 */
export function CodeLoginForm() {
  const { t } = useTranslation();
  const { codeLogin } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<CodeLoginFormValues>({
    resolver: zodResolver(codeLoginSchema),
    defaultValues: { access_code: "", child_name: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await codeLogin({
        access_code: values.access_code.trim(),
        child_name: values.child_name.trim(),
      });
      navigate("/parent", { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : t("validation.unexpected"),
      );
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError !== null && <Alert tone="danger">{formError}</Alert>}

      <Input
        label={t("auth.codeLabel")}
        placeholder="MAM-XXXX-XXXX"
        autoFocus
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        // Latin letters and digits whatever the interface language.
        dir="ltr"
        hint={t("auth.codeHint")}
        leftIcon={<KeyRound className="size-4" />}
        error={errors.access_code?.message}
        {...form.register("access_code")}
      />

      <Input
        label={t("auth.childNameLabel")}
        placeholder={t("auth.childNamePlaceholder")}
        autoComplete="off"
        hint={t("auth.childNameHint")}
        leftIcon={<Baby className="size-4" />}
        error={errors.child_name?.message}
        {...form.register("child_name")}
      />

      <Button type="submit" fullWidth size="lg" isLoading={isSubmitting}>
        {t("auth.signIn")}
      </Button>
    </form>
  );
}
