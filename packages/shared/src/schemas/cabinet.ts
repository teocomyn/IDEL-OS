import { z } from "zod";

export const cockpitCategorySchema = z.enum([
  "expiring_prescription",
  "renewal_request",
  "missing_document",
  "unvalidated_transmission",
  "active_without_visit",
  "rejected_invoice",
  "unpaid_invoice",
  "replacement_contract",
  "expiring_professional_document",
]);

export const cockpitListInputSchema = z.object({
  asOf: z.iso.date(),
  horizonDays: z.number().int().min(1).max(90).default(30),
  categories: z.array(cockpitCategorySchema).max(9).default([]),
});

export const adminTaskDecisionSchema = z.object({
  taskId: z.uuid(),
  action: z.enum(["done", "snooze", "reopen"]),
  snoozedUntil: z.iso.date().nullable().default(null),
}).superRefine((input, context) => {
  if (input.action === "snooze" && input.snoozedUntil === null) {
    context.addIssue({ code: "custom", path: ["snoozedUntil"], message: "Choisissez une date de rappel." });
  }
});

export const messageChannelSchema = z.enum(["email", "sms", "letter", "mssante"]);

export const messageDraftCreateSchema = z.object({
  draftId: z.uuid(),
  patientId: z.uuid().nullable().default(null),
  channel: messageChannelSchema,
  recipient: z.string().trim().min(2).max(320),
  subject: z.string().trim().min(2).max(200),
  body: z.string().trim().min(10).max(10_000),
  generatedFromRuleKey: z.string().trim().max(120).nullable().default(null),
});

export const messageDraftReferenceSchema = z.object({ draftId: z.uuid() });

export const cabinetDateRangeSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
}).refine((input) => input.from <= input.to, { message: "La période est invalide.", path: ["to"] });

export const patientPermissionSchema = z.enum(["read", "care", "transmission", "schedule", "billing"]);

export const patientAccessGrantSchema = z.object({
  grantId: z.uuid(),
  userId: z.uuid(),
  patientId: z.uuid(),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  permissions: z.array(patientPermissionSchema).min(1).max(5),
}).refine((input) => input.startsAt < input.endsAt, { message: "La période d’accès est invalide.", path: ["endsAt"] });

export const visitReassignmentPreviewSchema = z.object({
  changeId: z.uuid(),
  visitId: z.uuid(),
  toUserId: z.uuid(),
  reason: z.string().trim().min(3).max(500),
});

export const visitReassignmentApplySchema = z.object({ changeId: z.uuid() });

export const replacementContractInputSchema = z.object({
  contractId: z.uuid(),
  incumbentUserId: z.uuid(),
  replacementUserId: z.uuid(),
  startsOn: z.iso.date(),
  endsOn: z.iso.date(),
  retrocessionRate: z.number().min(0).max(100),
}).refine((input) => input.startsOn <= input.endsOn, { message: "La période du contrat est invalide.", path: ["endsOn"] });

export const retrocessionPreparationSchema = z.object({
  periodId: z.uuid(),
  incumbentUserId: z.uuid(),
  replacementUserId: z.uuid(),
  periodStart: z.iso.date(),
  periodEnd: z.iso.date(),
  grossAmountCents: z.number().int().min(0).max(100_000_000),
  rate: z.number().min(0).max(100),
}).refine((input) => input.periodStart <= input.periodEnd, { message: "La période de rétrocession est invalide.", path: ["periodEnd"] });

export type CockpitCategory = z.infer<typeof cockpitCategorySchema>;
export type CockpitListInput = z.infer<typeof cockpitListInputSchema>;
export type AdminTaskDecision = z.infer<typeof adminTaskDecisionSchema>;
export type MessageDraftCreate = z.infer<typeof messageDraftCreateSchema>;
export type PatientAccessGrantInput = z.infer<typeof patientAccessGrantSchema>;
export type VisitReassignmentPreview = z.infer<typeof visitReassignmentPreviewSchema>;
export type ReplacementContractInput = z.infer<typeof replacementContractInputSchema>;
export type RetrocessionPreparation = z.infer<typeof retrocessionPreparationSchema>;
