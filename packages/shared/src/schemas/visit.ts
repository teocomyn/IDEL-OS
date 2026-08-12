import { z } from "zod";

export const visitReferenceSchema = z.object({ visitId: z.uuid() });

export const visitActCompletionSchema = z.object({
  visitId: z.uuid(),
  visitActId: z.uuid(),
  performed: z.boolean(),
});

export const visitExceptionTypeSchema = z.enum([
  "absence",
  "refusal",
  "hospitalization",
  "emergency",
  "reschedule",
]);

export const visitExceptionInputSchema = z.object({
  visitId: z.uuid(),
  idempotencyKey: z.string().min(1).max(200),
  type: visitExceptionTypeSchema,
  note: z.string().trim().max(2_000).nullable().default(null),
  rescheduledAt: z.iso.datetime().optional(),
}).superRefine((input, context) => {
  if (input.type === "reschedule" && input.rescheduledAt === undefined) {
    context.addIssue({ code: "custom", path: ["rescheduledAt"], message: "Nouvelle date obligatoire." });
  }
  if (input.type !== "reschedule" && input.rescheduledAt !== undefined) {
    context.addIssue({ code: "custom", path: ["rescheduledAt"], message: "Date réservée au report." });
  }
});

export const todayVisitsInputSchema = z.object({
  date: z.iso.date(),
});

export const offlineVisitActionSchema = z.object({
  actionId: z.uuid(),
  idempotencyKey: z.string().min(1).max(200),
  kind: z.enum(["visit.start", "visit.set_act_performed", "visit.complete", "visit.exception"]),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
});

export const offlineVisitBatchSchema = z.object({
  deviceId: z.uuid(),
  actions: z.array(offlineVisitActionSchema).min(1).max(250),
});

export const mobileDeviceRegistrationSchema = z.object({
  deviceId: z.uuid(),
  label: z.string().min(1).max(120),
  platform: z.enum(["ios", "android"]),
  biometricEnabled: z.boolean(),
});

export const mobileDeviceReferenceSchema = z.object({ deviceId: z.uuid() });

export type VisitReference = z.infer<typeof visitReferenceSchema>;
export type VisitActCompletion = z.infer<typeof visitActCompletionSchema>;
export type VisitExceptionInput = z.infer<typeof visitExceptionInputSchema>;
export type OfflineVisitAction = z.infer<typeof offlineVisitActionSchema>;
