import type {
  AdminTaskDecision,
  CockpitCategory,
  CockpitListInput,
  EncryptedValue,
  MessageDraftCreate,
  OrganizationRole,
} from "@idel-os/shared";
import {
  adminTaskDecisionSchema,
  cockpitListInputSchema,
  DomainError,
  messageDraftCreateSchema,
  sanitizeLogContext,
} from "@idel-os/shared";
import type { EncryptionService } from "@idel-os/db";
import { buildAuditRecord } from "@idel-os/db";

import type { AuditSink } from "./patient-service.js";

export type CockpitPriority = "urgent" | "high" | "normal";

export type CockpitItem = {
  id: string;
  category: CockpitCategory;
  priority: CockpitPriority;
  title: string;
  detail: string;
  dueDate: string | null;
  patientId: string | null;
  resourceType: string;
  resourceId: string;
  amountCents: number | null;
  suggestedAction: string;
  taskId: string | null;
};

export type StoredMessageDraft = {
  id: string;
  organizationId: string;
  patientId: string | null;
  channel: MessageDraftCreate["channel"];
  recipientEnc: EncryptedValue;
  subjectEnc: EncryptedValue;
  bodyEnc: EncryptedValue;
  status: "draft" | "validated" | "sent" | "cancelled";
  generatedFromRuleKey: string | null;
  createdByUserId: string;
  validatedByUserId: string | null;
  validatedAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
};

export interface CockpitRepository {
  listItems(organizationId: string, asOf: string, horizonDays: number, actor: Actor): Promise<CockpitItem[]>;
  canPrepareMessageForPatient(organizationId: string, userId: string, patientId: string, at: Date): Promise<boolean>;
  decideTask(organizationId: string, actorUserId: string, decision: AdminTaskDecision): Promise<void>;
  createMessageDraft(draft: StoredMessageDraft): Promise<void>;
  findMessageDraft(organizationId: string, draftId: string): Promise<StoredMessageDraft | null>;
  listMessageDrafts(organizationId: string): Promise<StoredMessageDraft[]>;
  validateMessageDraft(organizationId: string, draftId: string, actorUserId: string, at: Date): Promise<void>;
}

type Actor = { userId: string; role: OrganizationRole };

export class CockpitService {
  public constructor(
    private readonly repository: CockpitRepository,
    private readonly audit: AuditSink,
    private readonly encryption: EncryptionService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async list(organizationId: string, actor: Actor, rawInput: CockpitListInput) {
    assertCanUseCockpit(actor.role);
    const input = cockpitListInputSchema.parse(rawInput);
    const items = await this.repository.listItems(organizationId, input.asOf, input.horizonDays, actor);
    const selected = input.categories.length === 0
      ? items
      : items.filter(({ category }) => input.categories.includes(category));
    const ordered = [...selected].sort((left, right) => {
      const score = { urgent: 0, high: 1, normal: 2 } as const;
      return score[left.priority] - score[right.priority]
        || (left.dueDate ?? "9999-12-31").localeCompare(right.dueDate ?? "9999-12-31");
    });
    return {
      asOf: input.asOf,
      total: ordered.length,
      urgentCount: ordered.filter(({ priority }) => priority === "urgent").length,
      amountToRecoverCents: ordered.reduce((sum, item) => sum + (item.amountCents ?? 0), 0),
      counts: Object.fromEntries(ordered.reduce((counts, item) => {
        counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
        return counts;
      }, new Map<CockpitCategory, number>())),
      items: ordered,
    };
  }

  public async decideTask(organizationId: string, actor: Actor, rawDecision: AdminTaskDecision) {
    assertCanUseCockpit(actor.role);
    const decision = adminTaskDecisionSchema.parse(rawDecision);
    await this.repository.decideTask(organizationId, actor.userId, decision);
    await this.writeAudit(organizationId, actor, "admin_task.decided", decision.taskId, null, {
      action: decision.action,
      snoozedUntil: decision.snoozedUntil,
    });
    return { taskId: decision.taskId, status: decision.action === "reopen" ? "open" : decision.action };
  }

  public async createMessageDraft(organizationId: string, actor: Actor, rawInput: MessageDraftCreate) {
    assertCanPrepareMessage(actor.role);
    const input = messageDraftCreateSchema.parse(rawInput);
    const now = this.now();
    if (actor.role === "secretaire" && input.patientId !== null && !await this.repository.canPrepareMessageForPatient(
      organizationId, actor.userId, input.patientId, now,
    )) {
      throw new DomainError("MESSAGE_PATIENT_ACCESS_FORBIDDEN", "Aucun accès administratif actif pour ce patient.");
    }
    const stored: StoredMessageDraft = {
      id: input.draftId,
      organizationId,
      patientId: input.patientId,
      channel: input.channel,
      recipientEnc: await this.encryption.encrypt(organizationId, input.recipient),
      subjectEnc: await this.encryption.encrypt(organizationId, input.subject),
      bodyEnc: await this.encryption.encrypt(organizationId, input.body),
      status: "draft",
      generatedFromRuleKey: input.generatedFromRuleKey,
      createdByUserId: actor.userId,
      validatedByUserId: null,
      validatedAt: null,
      sentAt: null,
      createdAt: now,
    };
    await this.repository.createMessageDraft(stored);
    await this.writeAudit(organizationId, actor, "message_draft.created", stored.id, null, {
      channel: stored.channel,
      patientId: stored.patientId,
      generatedFromRuleKey: stored.generatedFromRuleKey,
    });
    return { draftId: stored.id, status: stored.status, requiresHumanValidation: true };
  }

  public async validateMessageDraft(organizationId: string, actor: Actor, draftId: string) {
    assertCanValidateMessage(actor.role);
    const draft = await this.repository.findMessageDraft(organizationId, draftId);
    if (draft === null) throw new DomainError("MESSAGE_DRAFT_NOT_FOUND", "Brouillon introuvable.");
    if (draft.status !== "draft") throw new DomainError("MESSAGE_DRAFT_NOT_EDITABLE", "Ce brouillon a déjà été traité.");
    const at = this.now();
    await this.repository.validateMessageDraft(organizationId, draft.id, actor.userId, at);
    await this.writeAudit(organizationId, actor, "message_draft.validated", draft.id, { status: draft.status }, {
      status: "validated",
      validatedAt: at.toISOString(),
    });
    return { draftId: draft.id, status: "validated" as const, validatedAt: at, readyForDelivery: true };
  }

  public async listMessageDrafts(organizationId: string, actor: Actor) {
    assertCanPrepareMessage(actor.role);
    const drafts = await this.repository.listMessageDrafts(organizationId);
    return Promise.all(drafts.map(async (draft) => ({
      draftId: draft.id,
      patientId: draft.patientId,
      channel: draft.channel,
      recipient: await this.encryption.decrypt(organizationId, draft.recipientEnc),
      subject: await this.encryption.decrypt(organizationId, draft.subjectEnc),
      body: await this.encryption.decrypt(organizationId, draft.bodyEnc),
      status: draft.status,
      createdAt: draft.createdAt,
      validatedAt: draft.validatedAt,
      requiresHumanValidation: draft.status === "draft",
    })));
  }

  public async getValidatedMessageForDelivery(organizationId: string, actor: Actor, draftId: string) {
    assertCanPrepareMessage(actor.role);
    const draft = await this.repository.findMessageDraft(organizationId, draftId);
    if (draft === null) throw new DomainError("MESSAGE_DRAFT_NOT_FOUND", "Brouillon introuvable.");
    if (draft.status !== "validated") {
      throw new DomainError("MESSAGE_REQUIRES_VALIDATION", "Une validation humaine est obligatoire avant tout envoi.");
    }
    return {
      draftId: draft.id,
      channel: draft.channel,
      recipient: await this.encryption.decrypt(organizationId, draft.recipientEnc),
      subject: await this.encryption.decrypt(organizationId, draft.subjectEnc),
      body: await this.encryption.decrypt(organizationId, draft.bodyEnc),
      validatedAt: draft.validatedAt,
    };
  }

  private async writeAudit(
    organizationId: string,
    actor: Actor,
    action: string,
    resourceId: string,
    before: unknown,
    after: unknown,
  ) {
    await this.audit.append({
      organizationId,
      ...buildAuditRecord({
        actorUserId: actor.userId,
        actorRole: actor.role,
        action,
        resourceType: "administration",
        resourceId,
        before: sanitizeLogContext(before),
        after: sanitizeLogContext(after),
        aiProposalId: null,
        ip: null,
        userAgent: null,
      }),
    });
  }
}

function assertCanUseCockpit(role: OrganizationRole): void {
  if (role === "remplacant") throw new DomainError("COCKPIT_FORBIDDEN", "Le cockpit administratif est réservé au cabinet.");
}

function assertCanPrepareMessage(role: OrganizationRole): void {
  if (role === "remplacant") throw new DomainError("MESSAGE_DRAFT_FORBIDDEN", "La préparation des courriers est réservée au cabinet.");
}

function assertCanValidateMessage(role: OrganizationRole): void {
  if (role === "remplacant" || role === "secretaire") {
    throw new DomainError("MESSAGE_VALIDATION_FORBIDDEN", "Une IDEL titulaire ou collaboratrice doit valider ce message.");
  }
}
