import { z } from "zod";

/**
 * Client-side validation is a UX affordance only — the backend validates
 * everything again (docs/authentication.md 6). These messages exist to
 * catch typos before a round-trip, not to enforce security.
 *
 * The messages are translation keys, not sentences: a schema is a module
 * constant evaluated once at import, so baked-in text would freeze in
 * whichever language happened to be active then. `useFieldError`
 * resolves them at render, where the language is actually known.
 */

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "validation.emailRequired")
    .email("validation.emailInvalid"),
  password: z.string().min(1, "validation.passwordRequired"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const claimSchema = z
  .object({
    access_code: z
      .string()
      .min(1, "validation.codeRequired")
      .regex(
        /^[A-Za-z]{2,4}[\s-]?[A-Za-z0-9]{4,6}$/,
        "validation.codeFormat",
      ),
    first_name: z.string().min(1, "validation.firstNameRequired"),
    last_name: z.string().min(1, "validation.lastNameRequired"),
    email: z
      .string()
      .min(1, "validation.emailRequired")
      .email("validation.emailInvalid"),
    phone: z.string().optional(),
    relationship: z.enum(["MOTHER", "FATHER", "GUARDIAN", "OTHER"]),
    password: z
      .string()
      .min(10, "validation.passwordTooShort"),
    password_confirm: z.string().min(1, "validation.passwordConfirmRequired"),
  })
  .refine((values) => values.password === values.password_confirm, {
    message: "validation.passwordsDiffer",
    path: ["password_confirm"],
  });

export type ClaimFormValues = z.infer<typeof claimSchema>;
