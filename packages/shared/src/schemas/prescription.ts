import { z } from "zod";

export const prescriptionSourceSchema = z.enum(["photo", "pdf", "manual", "import"]);

export const captureQualitySchema = z.object({
  accepted: z.boolean(),
  score: z.number().min(0).max(100),
  issues: z.array(z.object({
    code: z.string().min(1),
    severity: z.enum(["blocking", "warning"]),
    message: z.string().min(1),
  })),
});

export const extractedFieldSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  label: z.string().min(1),
  value: z.string(),
  confidence: z.number().min(0).max(1),
  page: z.number().int().positive(),
  boundingBox: z.object({
    x: z.number().min(0),
    y: z.number().min(0),
    width: z.number().positive(),
    height: z.number().positive(),
  }).optional(),
  sourceText: z.string(),
  needsReview: z.boolean(),
});

export const prescriptionExtractionSchema = z.object({
  provider: z.string().min(1),
  providerVersion: z.string().min(1),
  rawText: z.string(),
  fields: z.array(extractedFieldSchema).min(1),
  overallConfidence: z.number().min(0).max(1),
  requiresHumanReview: z.literal(true),
});

export const prescriptionItemDraftSchema = z.object({
  id: z.uuid(),
  rawText: z.string().min(1),
  actType: z.string().min(1),
  description: z.string().min(1),
  frequency: z.record(z.string(), z.unknown()),
  durationDays: z.number().int().positive().nullable(),
  startDate: z.iso.date().nullable(),
  endDate: z.iso.date().nullable(),
  constraints: z.record(z.string(), z.unknown()).default({}),
  extractionConfidence: z.number().min(0).max(1),
});

export const prescriptionDraftInputSchema = z.object({
  prescriptionId: z.uuid(),
  patientId: z.uuid(),
  source: prescriptionSourceSchema,
  objectKey: z.string().min(1).max(1_024),
  captureQuality: captureQualitySchema,
  extraction: prescriptionExtractionSchema,
  prescribedAt: z.iso.date().nullable(),
  validFrom: z.iso.date().nullable(),
  validUntil: z.iso.date().nullable(),
  isRenewal: z.boolean().default(false),
  items: z.array(prescriptionItemDraftSchema).min(1),
});

export const fieldReviewSchema = z.object({
  fieldId: z.string().min(1),
  correctedValue: z.string(),
  confirmed: z.literal(true),
});

export const prescriptionValidationInputSchema = z.object({
  prescriptionId: z.uuid(),
  reviews: z.array(fieldReviewSchema).min(1),
});

export const prescriptionReferenceSchema = z.object({ prescriptionId: z.uuid() });

export type PrescriptionDraftInput = z.infer<typeof prescriptionDraftInputSchema>;
export type PrescriptionValidationInput = z.infer<typeof prescriptionValidationInputSchema>;
