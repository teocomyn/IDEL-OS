import { z } from "zod";

export const vitalSignTypeSchema = z.enum([
  "tension",
  "glycemie",
  "temperature",
  "poids",
  "spo2",
  "eva",
  "frequence_cardiaque",
]);

export const transmissionVitalSchema = z.object({
  type: vitalSignTypeSchema,
  value: z.number().finite(),
  value2: z.number().finite().nullable(),
  unit: z.string().trim().min(1).max(20),
  source: z.enum(["observed", "reported"]),
  measuredAt: z.iso.datetime(),
});

export const structuredTransmissionSchema = z.object({
  actsPerformed: z.array(z.object({
    label: z.string().trim().min(1).max(240),
    conformToProtocol: z.boolean().nullable(),
  })).max(30),
  observations: z.array(z.object({
    text: z.string().trim().min(1).max(1_000),
    source: z.enum(["observed", "reported", "not_measured"]),
  })).max(50),
  vitals: z.array(transmissionVitalSchema).max(30),
  concerns: z.array(z.object({
    text: z.string().trim().min(1).max(1_000),
    urgency: z.enum(["info", "a_surveiller", "a_signaler"]),
  })).max(20),
  nextVisitNotes: z.string().trim().max(2_000).nullable(),
  missingInfo: z.array(z.string().trim().min(1).max(240)).max(20),
});

export const transmissionDraftInputSchema = z.object({
  transmissionId: z.uuid(),
  patientId: z.uuid(),
  visitId: z.uuid(),
  rawTranscript: z.string().trim().min(1).max(12_000),
  structured: structuredTransmissionSchema,
  audioObjectKey: z.string().trim().min(1).max(500).nullable().default(null),
  audioDurationS: z.number().int().min(1).max(3_600).nullable().default(null),
  transcriptionMode: z.enum(["on_device", "hds_server", "manual"]),
});

export const transmissionReferenceSchema = z.object({
  transmissionId: z.uuid(),
});

export const transmissionReceiptInputSchema = transmissionReferenceSchema.extend({
  action: z.enum(["read", "acknowledge"]),
});

export const transmissionHandoverInputSchema = z.object({
  patientId: z.uuid(),
  beforeVisitId: z.uuid().optional(),
});

export const transmissionTourSummaryInputSchema = z.object({ date: z.iso.date() });

export type StructuredTransmission = z.infer<typeof structuredTransmissionSchema>;
export type TransmissionDraftInput = z.infer<typeof transmissionDraftInputSchema>;
export type TransmissionVital = z.infer<typeof transmissionVitalSchema>;
export type TransmissionReceiptInput = z.infer<typeof transmissionReceiptInputSchema>;
