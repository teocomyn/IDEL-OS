import { z } from "zod";

export const prescriberInputSchema = z.object({
  name: z.string().trim().min(2).max(200),
  rpps: z.string().regex(/^\d{11}$/),
  speciality: z.string().trim().max(120).nullable(),
  phone: z.string().trim().max(30).nullable(),
  email: z.email().nullable(),
  address: z.string().trim().max(300).nullable(),
  isFavorite: z.boolean().default(false),
});

export type PrescriberInput = z.infer<typeof prescriberInputSchema>;
