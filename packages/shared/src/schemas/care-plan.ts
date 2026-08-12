import { z } from "zod";

export const isoTimeSchema = z.string().regex(
  /^(?:[01]\d|2[0-3]):[0-5]\d$/,
  "L’heure doit être au format HH:mm.",
);

export const careTimeWindowSchema = z.object({
  start: isoTimeSchema,
  end: isoTimeSchema,
}).refine(({ start, end }) => start < end, {
  message: "La fin de la fenêtre doit être après son début.",
  path: ["end"],
});

export const careFrequencySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("daily"),
    timesPerDay: z.number().int().min(1).max(6),
    everyNDays: z.number().int().min(1).max(90),
    timeWindows: z.array(careTimeWindowSchema).min(1).max(6),
  }).refine(({ timesPerDay, timeWindows }) => timesPerDay === timeWindows.length, {
    message: "Une fenêtre horaire est requise pour chaque passage quotidien.",
    path: ["timeWindows"],
  }),
  z.object({
    kind: z.literal("weekly"),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    timeWindow: careTimeWindowSchema,
  }).transform((value) => ({ ...value, weekdays: [...new Set(value.weekdays)].sort() })),
  z.object({
    kind: z.literal("as_needed"),
    instructions: z.string().trim().min(1).max(500),
  }),
]);

export const carePlanScheduleInputSchema = z.object({
  patientId: z.string().trim().min(1).max(100),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  items: z.array(z.object({
    id: z.string().trim().min(1).max(100),
    label: z.string().trim().min(1).max(240),
    estimatedDurationMin: z.number().int().min(1).max(240),
    frequency: careFrequencySchema,
  })).min(1).max(50),
}).refine(({ startDate, endDate }) => startDate <= endDate, {
  message: "La date de fin doit être postérieure à la date de début.",
  path: ["endDate"],
});

export const carePlanActivationInputSchema = z.object({
  carePlanId: z.uuid(),
  patientId: z.uuid(),
  prescriptionId: z.uuid(),
  name: z.string().trim().min(1).max(160),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  items: z.array(z.object({
    id: z.uuid(),
    prescriptionItemId: z.uuid().nullable(),
    actCatalogId: z.uuid(),
    label: z.string().trim().min(1).max(240),
    estimatedDurationMin: z.number().int().min(1).max(240),
    requiresTwoNurses: z.boolean(),
    frequency: careFrequencySchema,
  })).min(1).max(50),
}).refine(({ startDate, endDate }) => startDate <= endDate, {
  message: "La date de fin doit être postérieure à la date de début.",
  path: ["endDate"],
});

export type CareTimeWindow = z.infer<typeof careTimeWindowSchema>;
export type CareFrequency = z.infer<typeof careFrequencySchema>;
export type CarePlanScheduleInput = z.infer<typeof carePlanScheduleInputSchema>;
export type CarePlanActivationInput = z.infer<typeof carePlanActivationInputSchema>;
