import { z } from "zod";

/**
 * Client-side validation is a UX affordance only — the backend validates
 * everything again (docs/authentication.md 6). These messages exist to
 * catch typos before a round-trip, not to enforce security.
 */

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "L'adresse e-mail est requise.")
    .email("Adresse e-mail invalide."),
  password: z.string().min(1, "Le mot de passe est requis."),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const claimSchema = z
  .object({
    access_code: z
      .string()
      .min(1, "Le code d'accès est requis.")
      .regex(
        /^[A-Za-z]{2,4}[\s-]?[A-Za-z0-9]{4,6}$/,
        "Format attendu : MAM-XXXXX.",
      ),
    first_name: z.string().min(1, "Le prénom est requis."),
    last_name: z.string().min(1, "Le nom est requis."),
    email: z
      .string()
      .min(1, "L'adresse e-mail est requise.")
      .email("Adresse e-mail invalide."),
    phone: z.string().optional(),
    relationship: z.enum(["MOTHER", "FATHER", "GUARDIAN", "OTHER"]),
    password: z
      .string()
      .min(10, "Le mot de passe doit contenir au moins 10 caractères."),
    password_confirm: z.string().min(1, "Veuillez confirmer le mot de passe."),
  })
  .refine((values) => values.password === values.password_confirm, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["password_confirm"],
  });

export type ClaimFormValues = z.infer<typeof claimSchema>;
