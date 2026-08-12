import type {
  EncryptedValue,
  OrganizationRole,
  StructuredTransmission,
  TransmissionDraftInput,
  TransmissionReceiptInput,
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
  audioObjectKey: string | null;
  audioDurationS: number | null;
  transcriptionMode: "on_device" | "hds_server" | "manual";
  rawTranscriptEnc: EncryptedValue;
  structuredJsonEnc: EncryptedValue;
  finalTextEnc: EncryptedValue;
  status: "draft" | "validated";
  validatedAt: Date | null;
  validatedByUserId: string | null;
  createdAt: Date;
};

export type StoredTransmissionReceipt = {
  organizationId: string;
  transmissionId: string;
  userId: string;
  readAt: Date | null;
  acknowledgedAt: Date | null;
};

export type TransmissionView = {
  id: string;
  visitId: string;
  patientId: string;
  authorUserId: string;
  audioDurationS: number | null;
  transcriptionMode: StoredTransmission["transcriptionMode"];
  rawTranscript: string;
  structured: StructuredTransmission;
  finalText: string;
  status: "draft" | "validated";
  validatedAt: Date | null;
  createdAt: Date;
  receipt: { readAt: Date | null; acknowledgedAt: Date | null } | null;
};

export interface TransmissionRepository {
  create(transmission: StoredTransmission): Promise<void>;
  findById(organizationId: string, transmissionId: string): Promise<StoredTransmission | null>;
  listByPatient(organizationId: string, patientId: string): Promise<StoredTransmission[]>;
  listValidatedForDate(organizationId: string, assignedUserId: string, date: string): Promise<StoredTransmission[]>;
  validateAndSaveVitals(transmission: StoredTransmission, structured: StructuredTransmission): Promise<void>;
  upsertReceipt(receipt: StoredTransmissionReceipt): Promise<void>;
  findReceipt(organizationId: string, transmissionId: string, userId: string): Promise<StoredTransmissionReceipt | null>;
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
      audioObjectKey: input.audioObjectKey,
      audioDurationS: input.audioDurationS,
      transcriptionMode: input.transcriptionMode,
      rawTranscriptEnc: await this.encryption.encrypt(command.organizationId, input.rawTranscript),
      structuredJsonEnc: await this.encryption.encrypt(command.organizationId, JSON.stringify(input.structured)),
      finalTextEnc: await this.encryption.encrypt(command.organizationId, finalText),
      status: "draft",
      validatedAt: null,
      validatedByUserId: null,
      createdAt: new Date(),
    };
    await this.repository.create(stored);
    await this.writeAudit(command.organizationId, command.actor, "transmission.draft_created", stored.id, null, {
      status: stored.status,
      patientId: stored.patientId,
      visitId: stored.visitId,
    });
    return this.decrypt(stored);
  }

  public async listByPatient(organizationId: string, patientId: string, viewerUserId?: string): Promise<TransmissionView[]> {
    const stored = await this.repository.listByPatient(organizationId, patientId);
    return Promise.all(stored.map((transmission) => this.decrypt(transmission, viewerUserId)));
  }

  public async sinceMyLastPassage(organizationId: string, actor: Actor, patientId: string): Promise<TransmissionView[]> {
    const stored = (await this.repository.listByPatient(organizationId, patientId))
      .filter(({ status }) => status === "validated")
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
    let lastOwn = -1;
    for (let index = stored.length - 1; index >= 0; index -= 1) {
      if (stored[index]?.authorUserId === actor.userId) {
        lastOwn = index;
        break;
      }
    }
    return Promise.all(stored.slice(lastOwn + 1).map((transmission) => this.decrypt(transmission, actor.userId)));
  }

  public async tourSummary(organizationId: string, actor: Actor, date: string) {
    const stored = await this.repository.listValidatedForDate(organizationId, actor.userId, date);
    const items = await Promise.all(stored.map((transmission) => this.decrypt(transmission, actor.userId)));
    return {
      date,
      unreadCount: items.filter(({ receipt }) => receipt?.readAt == null).length,
      acknowledgementPendingCount: items.filter(({ receipt }) => receipt?.acknowledgedAt == null).length,
      signalCount: items.reduce((sum, { structured }) => sum + structured.concerns.filter(({ urgency }) => urgency === "a_signaler").length, 0),
      items,
    };
  }

  public async receipt(command: { organizationId: string; actor: Actor; input: TransmissionReceiptInput }) {
    const transmission = await this.repository.findById(command.organizationId, command.input.transmissionId);
    if (transmission === null || transmission.status !== "validated") throw new DomainError("TRANSMISSION_NOT_FOUND", "Transmission validée introuvable.");
    const now = new Date();
    const existing = await this.repository.findReceipt(command.organizationId, transmission.id, command.actor.userId);
    const receipt: StoredTransmissionReceipt = {
      organizationId: command.organizationId,
      transmissionId: transmission.id,
      userId: command.actor.userId,
      readAt: existing?.readAt ?? now,
      acknowledgedAt: command.input.action === "acknowledge" ? now : existing?.acknowledgedAt ?? null,
    };
    await this.repository.upsertReceipt(receipt);
    return receipt;
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
    if (before.authorUserId !== command.actor.userId) throw new DomainError("TRANSMISSION_VALIDATION_FORBIDDEN", "Seule l’autrice peut valider ce brouillon clinique.");
    const after: StoredTransmission = { ...before, status: "validated", validatedAt: new Date(), validatedByUserId: command.actor.userId };
    const structured = structuredTransmissionSchema.parse(JSON.parse(
      await this.encryption.decrypt(after.organizationId, after.structuredJsonEnc),
    ));
    await this.repository.validateAndSaveVitals(after, structured);
    await this.writeAudit(command.organizationId, command.actor, "transmission.validated", after.id, {
      status: before.status,
    }, {
      status: after.status,
      validatedAt: after.validatedAt?.toISOString(),
    });
    return this.decrypt(after);
  }

  private async decrypt(stored: StoredTransmission, viewerUserId?: string): Promise<TransmissionView> {
    const structured = structuredTransmissionSchema.parse(JSON.parse(
      await this.encryption.decrypt(stored.organizationId, stored.structuredJsonEnc),
    ));
    return {
      id: stored.id,
      visitId: stored.visitId,
      patientId: stored.patientId,
      authorUserId: stored.authorUserId,
      audioDurationS: stored.audioDurationS,
      transcriptionMode: stored.transcriptionMode,
      rawTranscript: await this.encryption.decrypt(stored.organizationId, stored.rawTranscriptEnc),
      structured,
      finalText: await this.encryption.decrypt(stored.organizationId, stored.finalTextEnc),
      status: stored.status,
      validatedAt: stored.validatedAt,
      createdAt: stored.createdAt,
      receipt: viewerUserId === undefined ? null : await this.repository.findReceipt(stored.organizationId, stored.id, viewerUserId),
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
    ["Observations", structured.observations.map(({ text, source }) => `${source === "reported" ? "Rapporté" : source === "not_measured" ? "Non mesuré" : "Observé"} : ${text}`)],
    ["Constantes", structured.vitals.map(({ type, value, value2, unit, source }) => `${type} : ${value}${value2 === null ? "" : `/${value2}`} ${unit} (${source === "reported" ? "rapporté" : "mesuré"})`)],
    ["Points de vigilance", structured.concerns.map(({ text }) => text)],
    ["Prochain passage", structured.nextVisitNotes === null ? [] : [structured.nextVisitNotes]],
  ] as const;
  return sections
    .filter(([, values]) => values.length > 0)
    .map(([title, values]) => `${title}\n${values.map((value) => `- ${value}`).join("\n")}`)
    .join("\n\n");
}
