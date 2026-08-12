import { z } from "zod";

export const rppsSchema = z
  .string()
  .regex(/^\d{11}$/, "Le numéro RPPS doit contenir exactement 11 chiffres.");

export const adeliSchema = z
  .string()
  .regex(/^\d{9}$/, "Le numéro ADELI doit contenir exactement 9 chiffres.");

export const professionalIdentitySchema = z
  .object({
    rpps: rppsSchema.nullable(),
    adeli: adeliSchema.nullable(),
  })
  .refine(({ rpps, adeli }) => rpps !== null || adeli !== null, {
    message: "Un numéro RPPS ou ADELI est obligatoire.",
    path: ["rpps"],
  });

export type ProfessionalIdentity = z.infer<typeof professionalIdentitySchema>;
