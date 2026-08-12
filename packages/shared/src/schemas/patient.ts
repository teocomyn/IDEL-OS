import { z } from "zod";

export const patientInputSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  birthDate: z.iso.date(),
  phone: z.string().trim().max(30).nullable().default(null),
  email: z.email().nullable().default(null),
  notes: z.string().trim().max(5_000).nullable().default(null),
  addressLine: z.string().trim().max(300),
  postalCode: z.string().regex(/^\d{5}$/),
  city: z.string().trim().min(1).max(120),
  accessNotes: z.string().trim().max(1_000).nullable().default(null),
  mobility: z.enum(["autonomous", "assisted", "bedridden"]),
  isAld: z.boolean(),
  aldDetails: z.string().trim().max(1_000).nullable().default(null),
  isDiabetic: z.boolean(),
});

export const patientPatchSchema = patientInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "Au moins un champ doit être modifié.",
);

export type PatientInput = z.infer<typeof patientInputSchema>;
export type PatientPatch = z.infer<typeof patientPatchSchema>;
