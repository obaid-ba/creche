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

export const codeLoginSchema = z.object({
  access_code: z.string().trim().min(1, "validation.codeRequired"),
  child_name: z.string().trim().min(1, "validation.childNameRequired"),
});

export type CodeLoginFormValues = z.infer<typeof codeLoginSchema>;
