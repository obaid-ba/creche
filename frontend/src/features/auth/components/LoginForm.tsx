import { KeyRound, Mail } from "lucide-react";

import { Alert, Button, Input } from "@/components/ui";

import { useLoginForm } from "../useLoginForm";

export function LoginForm({ area }: { area: "parent" | "staff" }) {
  const { form, onSubmit, formError } = useLoginForm(area);
  const { errors, isSubmitting } = form.formState;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError !== null && <Alert tone="danger">{formError}</Alert>}

      <Input
        label="Adresse e-mail"
        type="email"
        autoComplete="email"
        autoFocus
        placeholder="vous@exemple.com"
        leftIcon={<Mail className="size-4" />}
        error={errors.email?.message}
        {...form.register("email")}
      />

      <Input
        label="Mot de passe"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        leftIcon={<KeyRound className="size-4" />}
        error={errors.password?.message}
        {...form.register("password")}
      />

      <Button type="submit" fullWidth size="lg" isLoading={isSubmitting}>
        Se connecter
      </Button>
    </form>
  );
}
