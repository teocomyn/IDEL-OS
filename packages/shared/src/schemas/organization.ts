import { z } from "zod";

export const organizationInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(["solo", "cabinet"]),
  siret: z.string().regex(/^\d{14}$/).nullable(),
  address: z.string().trim().max(300).nullable(),
});

export type OrganizationInput = z.infer<typeof organizationInputSchema>;
