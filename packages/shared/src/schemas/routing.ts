import { z } from "zod";

export const routingProposalInputSchema = z.object({
  date: z.iso.date(),
  anchorAt: z.iso.datetime().optional(),
  lockedVisitIds: z.array(z.uuid()).max(100).default([]),
});

export const routingApplyInputSchema = z.object({
  optimizationRunId: z.uuid(),
});

export type RoutingProposalInput = z.infer<typeof routingProposalInputSchema>;
export type RoutingApplyInput = z.infer<typeof routingApplyInputSchema>;
