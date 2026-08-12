import { z } from "zod";

export const visitReferenceSchema = z.object({ visitId: z.uuid() });

export const visitActCompletionSchema = z.object({
  visitId: z.uuid(),
  visitActId: z.uuid(),
  performed: z.boolean(),
});

export type VisitReference = z.infer<typeof visitReferenceSchema>;
export type VisitActCompletion = z.infer<typeof visitActCompletionSchema>;
