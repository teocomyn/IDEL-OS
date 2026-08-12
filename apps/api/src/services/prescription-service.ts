import { buildAuditRecord, type EncryptionService } from "@idel-os/db";
import { assertExtractionFullyReviewed } from "@idel-os/ocr";
import {
  DomainError,
  prescriptionDraftInputSchema,
  prescriptionValidationInputSchema,
  type EncryptedValue,
  type OrganizationRole,
  type PrescriptionDraftInput,
  type PrescriptionValidationInput,
} from "@idel-os/shared";

import type { AuditSink } from "./patient-service.js";

type Actor = { userId: string; role: OrganizationRole };

export type StoredPrescription = {
  id: string;
  organizationId: string;
  patientId: string;
  source: PrescriptionDraftInput["source"];
  objectKey: string;
  prescribedAt: string | null;
  validFrom: string | null;
  validUntil: string | null;
  isRenewal: boolean;
  rawOcrTextEnc: EncryptedValue;
  extraction: Omit<PrescriptionDraftInput["extraction"], "rawText">;
  captureQuality: PrescriptionDraftInput["captureQuality"];
  extractionConfidence: number;
  status: "draft" | "validated" | "expired" | "archived";
  validatedByUserId: string | null;
  validatedAt: Date | null;
  reviews: PrescriptionValidationInput["reviews"];
  items: PrescriptionDraftInput["items"];
};

export interface PrescriptionRepository {
  create(prescription: StoredPrescription): Promise<void>;
  findById(organizationId: string, prescriptionId: string): Promise<StoredPrescription | null>;
  update(prescription: StoredPrescription): Promise<void>;
}

export class PrescriptionService {
  public constructor(
    private readonly repository: PrescriptionRepository,
    private readonly audit: AuditSink,
    private readonly encryption: EncryptionService,
  ) {}

  public async createDraft(command: {
    organizationId: string;
    actor: Actor;
    input: PrescriptionDraftInput;
  }): Promise<{ prescriptionId: string; status: "draft"; reviewFieldCount: number }> {
    const input = prescriptionDraftInputSchema.parse(command.input);
    if (!input.captureQuality.accepted) {
      throw new DomainError(
        "PRESCRIPTION_CAPTURE_REJECTED",
        "La qualité du document est insuffisante. Reprenez la photo avant l’extraction.",
      );
    }
    const blockingIssue = input.captureQuality.issues.find(({ severity }) => severity === "blocking");
    if (blockingIssue !== undefined) {
      throw new DomainError("PRESCRIPTION_CAPTURE_REJECTED", blockingIssue.message);
    }
    const existing = await this.repository.findById(command.organizationId, input.prescriptionId);
    if (existing !== null) {
      throw new DomainError("PRESCRIPTION_ALREADY_EXISTS", "Cette ordonnance existe déjà.");
    }

    const { rawText, ...safeExtraction } = input.extraction;
    const stored: StoredPrescription = {
      id: input.prescriptionId,
      organizationId: command.organizationId,
      patientId: input.patientId,
      source: input.source,
      objectKey: input.objectKey,
      prescribedAt: input.prescribedAt,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      isRenewal: input.isRenewal,
      rawOcrTextEnc: await this.encryption.encrypt(command.organizationId, rawText),
      extraction: safeExtraction,
      captureQuality: input.captureQuality,
      extractionConfidence: input.extraction.overallConfidence,
      status: "draft",
      validatedByUserId: null,
      validatedAt: null,
      reviews: [],
      items: input.items,
    };
    await this.repository.create(stored);
    await this.audit.append({
      organizationId: command.organizationId,
      ...buildAuditRecord({
        actorUserId: command.actor.userId,
        actorRole: command.actor.role,
        action: "prescription.draft_created",
        resourceType: "prescription",
        resourceId: input.prescriptionId,
        before: null,
        after: {
          source: input.source,
          captureScore: input.captureQuality.score,
          extractionConfidence: input.extraction.overallConfidence,
          fieldCount: input.extraction.fields.length,
        },
        aiProposalId: null,
        ip: null,
        userAgent: null,
      }),
    });
    return {
      prescriptionId: input.prescriptionId,
      status: "draft",
      reviewFieldCount: input.extraction.fields.length,
    };
  }

  public async getReview(organizationId: string, prescriptionId: string) {
    const stored = await this.getStored(organizationId, prescriptionId);
    return {
      prescriptionId: stored.id,
      patientId: stored.patientId,
      status: stored.status,
      captureQuality: stored.captureQuality,
      extraction: stored.extraction,
      items: stored.items,
      reviews: stored.reviews,
    };
  }

  public async validate(command: {
    organizationId: string;
    actor: Actor;
    input: PrescriptionValidationInput;
  }): Promise<{ prescriptionId: string; status: "validated"; validatedAt: Date }> {
    if (command.actor.role === "secretaire") {
      throw new DomainError(
        "PRESCRIPTION_VALIDATION_FORBIDDEN",
        "La validation clinique doit être réalisée par un professionnel infirmier.",
      );
    }
    const input = prescriptionValidationInputSchema.parse(command.input);
    const stored = await this.getStored(command.organizationId, input.prescriptionId);
    if (stored.status !== "draft") {
      throw new DomainError("PRESCRIPTION_NOT_DRAFT", "Cette ordonnance n’est plus en attente de relecture.");
    }
    assertExtractionFullyReviewed(
      { ...stored.extraction, rawText: "", requiresHumanReview: true },
      input.reviews,
    );
    const validatedAt = new Date();
    const updated: StoredPrescription = {
      ...stored,
      status: "validated",
      validatedByUserId: command.actor.userId,
      validatedAt,
      reviews: input.reviews,
    };
    await this.repository.update(updated);
    await this.audit.append({
      organizationId: command.organizationId,
      ...buildAuditRecord({
        actorUserId: command.actor.userId,
        actorRole: command.actor.role,
        action: "prescription.human_validated",
        resourceType: "prescription",
        resourceId: input.prescriptionId,
        before: { status: stored.status },
        after: {
          status: updated.status,
          reviewedFieldCount: input.reviews.length,
          correctedFieldCount: input.reviews.filter((review) => {
            const field = stored.extraction.fields.find(({ id }) => id === review.fieldId);
            return field !== undefined && field.value !== review.correctedValue;
          }).length,
        },
        aiProposalId: null,
        ip: null,
        userAgent: null,
      }),
    });
    return { prescriptionId: input.prescriptionId, status: "validated", validatedAt };
  }

  private async getStored(organizationId: string, prescriptionId: string): Promise<StoredPrescription> {
    const stored = await this.repository.findById(organizationId, prescriptionId);
    if (stored === null) throw new DomainError("PRESCRIPTION_NOT_FOUND", "Ordonnance introuvable.");
    return stored;
  }
}
