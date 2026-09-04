import { z } from "zod";

/** Client-side validation only; the backend validates again. */
export const childSchema = z.object({
  first_name: z.string().trim().min(1, "Le prénom est requis.").max(80),
  last_name: z.string().trim().min(1, "Le nom est requis.").max(80),
  date_of_birth: z
    .string()
    .min(1, "La date de naissance est requise.")
    .refine((value) => !Number.isNaN(Date.parse(value)), "Date invalide.")
    .refine((value) => {
      // Compare date-only to avoid a timezone shift rejecting a birth
      // registered today.
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      return new Date(value) <= today;
    }, "La date de naissance ne peut pas être dans le futur."),
  gender: z.enum(["M", "F", "OTHER", ""]).optional(),
  registration_date: z.string().optional(),
  allergies: z.string().optional(),
  medical_notes: z.string().optional(),
  notes: z.string().optional(),
});

export type ChildFormValues = z.infer<typeof childSchema>;
