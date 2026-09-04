import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Mail, User } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";

import { Alert, Button, Input } from "@/components/ui";
import { ApiError } from "@/services/errors";

import { claimSchema, type ClaimFormValues } from "../schemas";
import { useAuth } from "../useAuth";

const RELATIONSHIPS = [
  { value: "MOTHER", label: "Mère" },
  { value: "FATHER", label: "Père" },
  { value: "GUARDIAN", label: "Tuteur / Tutrice" },
  { value: "OTHER", label: "Autre" },
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
              message: "Une erreur inattendue est survenue.",
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
        label="Code d'accès"
        placeholder="MAM-XXXXX"
        autoFocus
        autoComplete="off"
        spellCheck={false}
        hint="Ce code vous a été remis par la crèche."
        leftIcon={<KeyRound className="size-4" />}
        error={errors.access_code?.message}
        {...form.register("access_code")}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Prénom"
          autoComplete="given-name"
          leftIcon={<User className="size-4" />}
          error={errors.first_name?.message}
          {...form.register("first_name")}
        />
        <Input
          label="Nom"
          autoComplete="family-name"
          error={errors.last_name?.message}
          {...form.register("last_name")}
        />
      </div>

      <div>
        <label
          htmlFor="relationship"
          className="mb-1.5 block text-sm font-semibold text-ink-700"
        >
          Lien avec l'enfant
        </label>
        <select
          id="relationship"
          className="h-11 w-full rounded-card border border-ink-200 bg-white px-3.5 text-sm text-ink-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
          {...form.register("relationship")}
        >
          {RELATIONSHIPS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <Input
        label="Adresse e-mail"
        type="email"
        autoComplete="email"
        leftIcon={<Mail className="size-4" />}
        error={errors.email?.message}
        {...form.register("email")}
      />

      <Input
        label="Téléphone (facultatif)"
        type="tel"
        autoComplete="tel"
        error={errors.phone?.message}
        {...form.register("phone")}
      />

      <Input
        label="Mot de passe"
        type="password"
        autoComplete="new-password"
        hint="Au moins 10 caractères."
        error={errors.password?.message}
        {...form.register("password")}
      />

      <Input
        label="Confirmer le mot de passe"
        type="password"
        autoComplete="new-password"
        error={errors.password_confirm?.message}
        {...form.register("password_confirm")}
      />

      <Button type="submit" fullWidth size="lg" isLoading={isSubmitting}>
        Activer mon compte
      </Button>
    </form>
  );
}
