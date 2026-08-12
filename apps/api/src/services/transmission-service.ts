import type {
  EncryptedValue,
  OrganizationRole,
  StructuredTransmission,
  TransmissionDraftInput,
} from "@idel-os/shared";
import {
  DomainError,
  structuredTransmissionSchema,
  transmissionDraftInputSchema,
} from "@idel-os/shared";
import type { EncryptionService } from "@idel-os/db";
import { buildAuditRecord } from "@idel-os/db";

import type { AuditSink } from "./patient-service.js";

export type StoredTransmission = {
  id: string;
  organizationId: string;
  visitId: string;
  patientId: string;
  authorUserId: string;
  rawTranscriptEnc: EncryptedValue;
  structuredJsonEnc: EncryptedValue;
  finalTextEnc: EncryptedValue;
  status: "draft" | "validated";
  validatedAt: Date | null;
};

export type TransmissionView = {
  id: string;
  visitId: string;
  patientId: string;
  authorUserId: string;
  rawTranscript: string;
  structured: StructuredTransmission;
  finalText: string;
  status: "draft" | "validated";
  validatedAt: Date | null;
};

export interface TransmissionRepository {
  create(transmission: StoredTransmission): Promise<void>;
  findById(organizationId: string, transmissionId: string): Promise<StoredTransmission | null>;
  listByPatient(organizationId: string, patientId: string): Promise<StoredTransmission[]>;
  update(transmission: StoredTransmission): Promise<void>;
}

type Actor = { userId: string; role: OrganizationRole };

export class TransmissionService {
  public constructor(
    private readonly repository: TransmissionRepository,
    private readonly audit: AuditSink,
    private readonly encryption: EncryptionService,
  ) {}

  public async createDraft(command: {
    organizationId: string;
    actor: Actor;
    input: TransmissionDraftInput;
  }): Promise<TransmissionView> {
    const input = transmissionDraftInputSchema.parse(command.input);
    const finalText = formatTransmission(input.structured);
    const stored: StoredTransmission = {
      id: input.transmissionId,
      organizationId: command.organizationId,
      visitId: input.visitId,
      patientId: input.patientId,
      authorUserId: command.actor.userId,
      rawTranscriptEnc: await this.encryption.encrypt(command.organizationId, input.rawTranscript),
      structuredJsonEnc: await this.encryption.encrypt(command.organizationId, JSON.stringify(input.structured)),
      finalTextEnc: await this.encryption.encrypt(command.organizationId, finalText),
      status: "draft",
      validatedAt: null,
    };
    await this.repository.create(stored);
    await this.writeAudit(command.organizationId, command.actor, "transmission.draft_created", stored.id, null, {
      status: stored.status,
      patientId: stored.patientId,
      visitId: stored.visitId,
    });
    return this.decrypt(stored);
  }

  public async listByPatient(organizationId: string, patientId: string): Promise<TransmissionView[]> {
    const stored = await this.repository.listByPatient(organizationId, patientId);
    return Promise.all(stored.map((transmission) => this.decrypt(transmission)));
  }

  public async validate(command: {
    organizationId: string;
    actor: Actor;
    transmissionId: string;
  }): Promise<TransmissionView> {
    const before = await this.repository.findById(command.organizationId, command.transmissionId);
    if (before === null) {
      throw new DomainError("TRANSMISSION_NOT_FOUND", "Transmission introuvable.");
    }
    if (before.status === "validated") {
      throw new DomainError("TRANSMISSION_ALREADY_VALIDATED", "Cette transmission est déjà validée.");
    }
    const after: StoredTransmission = { ...before, status: "validated", validatedAt: new Date() };
    await this.repository.update(after);
    await this.writeAudit(command.organizationId, command.actor, "transmission.validated", after.id, {
      status: before.status,
    }, {
      status: after.status,
      validatedAt: after.validatedAt?.toISOString(),
    });
    return this.decrypt(after);
  }

  private async decrypt(stored: StoredTransmission): Promise<TransmissionView> {
    const structured = structuredTransmissionSchema.parse(JSON.parse(
      await this.encryption.decrypt(stored.organizationId, stored.structuredJsonEnc),
    ));
    return {
      id: stored.id,
      visitId: stored.visitId,
      patientId: stored.patientId,
      authorUserId: stored.authorUserId,
      rawTranscript: await this.encryption.decrypt(stored.organizationId, stored.rawTranscriptEnc),
      structured,
      finalText: await this.encryption.decrypt(stored.organizationId, stored.finalTextEnc),
      status: stored.status,
      validatedAt: stored.validatedAt,
    };
  }

  private async writeAudit(
    organizationId: string,
    actor: Actor,
    action: string,
    resourceId: string,
    before: unknown,
    after: unknown,
  ): Promise<void> {
    await this.audit.append({
      organizationId,
      ...buildAuditRecord({
        actorUserId: actor.userId,
        actorRole: actor.role,
        action,
        resourceType: "transmission",
        resourceId,
        before,
        after,
        aiProposalId: null,
        ip: null,
        userAgent: null,
      }),
    });
  }
}

export function formatTransmission(structured: StructuredTransmission): string {
  const sections = [
    ["Actes réalisés", structured.actsPerformed.map(({ label }) => label)],
    ["Observations", structured.observations.map(({ text, source }) => `${source === "reported" ? "Rapporté" : "Observé"} : ${text}`)],
    ["Points de vigilance", structured.concerns.map(({ text }) => text)],
    ["Prochain passage", structured.nextVisitNotes === null ? [] : [structured.nextVisitNotes]],
  ] as const;
  return sections
    .filter(([, values]) => values.length > 0)
    .map(([title, values]) => `${title}\n${values.map((value) => `- ${value}`).join("\n")}`)
    .join("\n\n");
}
