import { describe, expect, it } from "vitest";

import { EncryptionService, LocalKeyProvider } from "@idel-os/db";

import {
  InMemoryAuditSink,
  InMemoryPrescriptionRepository,
} from "../src/services/in-memory-repositories.js";
import { PrescriptionService } from "../src/services/prescription-service.js";

const organizationId = "0198f54c-4064-7000-8000-000000000501";
const patientId = "0198f54c-4064-7000-8000-000000000502";
const prescriptionId = "0198f54c-4064-7000-8000-000000000503";
const actor = { userId: "0198f54c-4064-7000-8000-000000000504", role: "idel" as const };

const draft = {
  prescriptionId,
  patientId,
  source: "photo" as const,
  objectKey: `${organizationId}/prescriptions/${prescriptionId}/original.jpg`,
  captureQuality: { accepted: true, score: 100, issues: [] },
  extraction: {
    provider: "fixture-hds",
    providerVersion: "1",
    rawText: "Mme Exemple - pansement quotidien",
    fields: [{
      id: "care-1",
      path: "items.0.description",
      label: "Soin",
      value: "Pansement quotidien",
      confidence: 0.91,
      page: 1,
      sourceText: "pansement quotidien",
      needsReview: true,
    }],
    overallConfidence: 0.91,
    requiresHumanReview: true as const,
  },
  prescribedAt: "2026-08-12",
  validFrom: "2026-08-13",
  validUntil: "2026-08-26",
  isRenewal: false,
  items: [{
    id: "0198f54c-4064-7000-8000-000000000505",
    rawText: "pansement quotidien",
    actType: "wound_care",
    description: "Pansement quotidien",
    frequency: { kind: "daily", timesPerDay: 1 },
    durationDays: 14,
    startDate: "2026-08-13",
    endDate: "2026-08-26",
    constraints: {},
    extractionConfidence: 0.91,
  }],
};

function setup() {
  const repository = new InMemoryPrescriptionRepository();
  const audit = new InMemoryAuditSink();
  const encryption = new EncryptionService(new LocalKeyProvider(Buffer.alloc(32, 7)));
  return { repository, audit, service: new PrescriptionService(repository, audit, encryption) };
}

describe("PrescriptionService", () => {
  it("bloque un document rejeté par le contrôle qualité", async () => {
    const { service } = setup();
    await expect(service.createDraft({
      organizationId,
      actor,
      input: { ...draft, captureQuality: { accepted: false, score: 30, issues: [] } },
    })).rejects.toThrow("qualité du document");
  });

  it("chiffre le texte OCR et crée une revue obligatoire", async () => {
    const { service, repository } = setup();
    await service.createDraft({ organizationId, actor, input: draft });
    const stored = await repository.findById(organizationId, prescriptionId);
    expect(stored?.status).toBe("draft");
    expect(stored?.rawOcrTextEnc).not.toContain("Mme Exemple");
    expect((await service.getReview(organizationId, prescriptionId)).extraction.fields).toHaveLength(1);
  });

  it("refuse une validation partielle puis trace la validation humaine complète", async () => {
    const { service, audit } = setup();
    await service.createDraft({ organizationId, actor, input: draft });
    await expect(service.validate({
      organizationId,
      actor,
      input: { prescriptionId, reviews: [{ fieldId: "other", correctedValue: "", confirmed: true }] },
    })).rejects.toThrow("Relecture incomplète");

    const result = await service.validate({
      organizationId,
      actor,
      input: {
        prescriptionId,
        reviews: [{ fieldId: "care-1", correctedValue: "Pansement stérile quotidien", confirmed: true }],
      },
    });
    expect(result.status).toBe("validated");
    expect(audit.records.map(({ action }) => action)).toEqual([
      "prescription.draft_created",
      "prescription.human_validated",
    ]);
  });
});
