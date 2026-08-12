import { z } from "zod";

export const privacyRequestSchema = z.object({
  patientId: z.uuid(),
  kind: z.enum(["export", "rectification", "erasure"]),
  reason: z.string().trim().max(1_000).nullable().default(null),
});

export type PrivacyRequest = z.infer<typeof privacyRequestSchema>;
