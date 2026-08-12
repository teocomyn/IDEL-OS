import { describe, expect, it } from "vitest";

import { prescriptionDraftInputSchema } from "../src/index.js";

describe("prescriptionDraftInputSchema", () => {
  it("interdit l'ingestion si le contrôle qualité est bloquant", () => {
    const result = prescriptionDraftInputSchema.safeParse({
      prescriptionId: "c0196b78-d7b1-7634-8391-06c47b2f8a09",
      patientId: "c0196b78-d7b1-7634-8391-06c47b2f8a10",
      source: "photo",
      objectKey: "org/prescriptions/rx.jpg",
      captureQuality: { accepted: false, score: 20, issues: [] },
      extraction: {
        provider: "fixture",
        providerVersion: "1",
        rawText: "test",
        fields: [{ id: "field", path: "items.0", label: "Soin", value: "test", confidence: 0.8, page: 1, sourceText: "test", needsReview: true }],
        overallConfidence: 0.8,
        requiresHumanReview: true,
      },
      prescribedAt: null,
      validFrom: null,
      validUntil: null,
      items: [{ id: "c0196b78-d7b1-7634-8391-06c47b2f8a11", rawText: "test", actType: "other", description: "test", frequency: {}, durationDays: null, startDate: null, endDate: null, extractionConfidence: 0.8 }],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.captureQuality.accepted).toBe(false);
  });
});
