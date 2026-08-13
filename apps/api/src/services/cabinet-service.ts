import type {
  OrganizationRole,
  PatientAccessGrantInput,
  ReplacementContractInput,
  RetrocessionPreparation,
  VisitReassignmentPreview,
} from "@idel-os/shared";
import {
  cabinetDateRangeSchema,
  DomainError,
  patientAccessGrantSchema,
  replacementContractInputSchema,
  retrocessionPreparationSchema,
  sanitizeLogContext,
  visitReassignmentPreviewSchema,
} from "@idel-os/shared";
import { buildAuditRecord } from "@idel-os/db";

import type { AuditSink } from "./patient-service.js";

export type TeamMemberView = {
  id: string;
  displayName: string;
  role: OrganizationRole;
  roleLabel: string;
  isActive: boolean;
  lastSeenAt: Date | null;
};

export type SharedScheduleItem = {
  visitId: string;
  patientId: string;
  patientLabel: string;
  patientMasked: boolean;
  assignedUserId: string | null;
  assignedUserLabel: string;
  scheduledAt: Date;
  estimatedDurationMin: number;
  status: string;
};

export type WorkloadView = {
  userId: string;
  displayName: string;
  visitCount: number;
  completedCount: number;
  plannedMinutes: number;
  workloadPercent: number;
};

export type CollectiveHandoverItem = {
  transmissionId: string;
  patientId: string;
  patientLabel: string;
  patientMasked: boolean;
  authorLabel: string;
  finalText: string | null;
  createdAt: Date;
  signalCount: number;
};

export type ImportantNotification = {
  id: string;
  severity: "important" | "urgent";
  kind: string;
  title: string;
  resourceType: string | null;
  resourceId: string | null;
  createdAt: Date;
};

export type CabinetHistoryItem = {
  id: string;
  action: string;
  actorUserId: string;
  actorLabel: string;
  resourceType: string;
  resourceId: string;
  createdAt: Date;
};

export type CabinetDashboard = {
  from: string;
  to: string;
  members: TeamMemberView[];
  schedule: SharedScheduleItem[];
  workloads: WorkloadView[];
  handover: CollectiveHandoverItem[];
  notifications: ImportantNotification[];
  activeContracts: number;
  retrocessionsToValidate: number;
  recentChanges: CabinetHistoryItem[];
};

export type AssignmentChange = {
  id: string;
  organizationId: string;
  visitId: string;
  fromUserId: string | null;
  toUserId: string;
  reason: string;
  status: "proposed" | "applied" | "rejected";
  proposedByUserId: string;
  createdAt: Date;
};

export interface CabinetRepository {
  dashboard(
    organizationId: string,
    actor: { userId: string; role: OrganizationRole },
    from: string,
    to: string,
  ): Promise<CabinetDashboard>;
  upsertAccessGrant(organizationId: string, actorUserId: string, grant: PatientAccessGrantInput): Promise<void>;
  createReplacementContract(organizationId: string, actorUserId: string, contract: ReplacementContractInput): Promise<void>;
  createRetrocession(organizationId: string, actorUserId: string, preparation: RetrocessionPreparation & { amountCents: number }): Promise<void>;
  getVisitAssignment(organizationId: string, visitId: string): Promise<{ assignedUserId: string | null; scheduledAt: Date; status: string } | null>;
  createAssignmentChange(change: AssignmentChange): Promise<void>;
  getAssignmentChange(organizationId: string, changeId: string): Promise<AssignmentChange | null>;
  applyAssignmentChange(organizationId: string, changeId: string, actorUserId: string): Promise<void>;
}

type Actor = { userId: string; role: OrganizationRole };

export class CabinetService {
  public constructor(
    private readonly repository: CabinetRepository,
    private readonly audit: AuditSink,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async dashboard(organizationId: string, actor: Actor, range: { from: string; to: string }) {
    const input = cabinetDateRangeSchema.parse(range);
    return this.repository.dashboard(organizationId, actor, input.from, input.to);
  }

  public async grantPatientAccess(organizationId: string, actor: Actor, rawGrant: PatientAccessGrantInput) {
    assertCanManageCabinet(actor.role);
    const grant = patientAccessGrantSchema.parse(rawGrant);
    await this.repository.upsertAccessGrant(organizationId, actor.userId, grant);
    await this.writeAudit(organizationId, actor, "patient_access.granted", grant.grantId, null, {
      userId: grant.userId,
      patientId: grant.patientId,
      startsAt: grant.startsAt,
      endsAt: grant.endsAt,
      permissions: grant.permissions,
    });
    return { grantId: grant.grantId, active: true };
  }

  public async createReplacementContract(organizationId: string, actor: Actor, rawContract: ReplacementContractInput) {
    assertCanManageCabinet(actor.role);
    const contract = replacementContractInputSchema.parse(rawContract);
    if (contract.incumbentUserId === contract.replacementUserId) {
      throw new DomainError("CONTRACT_SAME_PROFESSIONAL", "La titulaire et la remplaçante doivent être différentes.");
    }
    await this.repository.createReplacementContract(organizationId, actor.userId, contract);
    await this.writeAudit(organizationId, actor, "replacement_contract.created", contract.contractId, null, {
      incumbentUserId: contract.incumbentUserId,
      replacementUserId: contract.replacementUserId,
      startsOn: contract.startsOn,
      endsOn: contract.endsOn,
      retrocessionRate: contract.retrocessionRate,
      status: "draft",
    });
    return { contractId: contract.contractId, status: "draft" as const, requiresSignature: true };
  }

  public async prepareRetrocession(organizationId: string, actor: Actor, rawPreparation: RetrocessionPreparation) {
    assertCanManageCabinet(actor.role);
    const preparation = retrocessionPreparationSchema.parse(rawPreparation);
    if (preparation.incumbentUserId === preparation.replacementUserId) {
      throw new DomainError("RETROCESSION_SAME_PROFESSIONAL", "La rétrocession doit concerner deux professionnelles différentes.");
    }
    const amountCents = Math.round(preparation.grossAmountCents * preparation.rate / 100);
    await this.repository.createRetrocession(organizationId, actor.userId, { ...preparation, amountCents });
    await this.writeAudit(organizationId, actor, "retrocession.prepared", preparation.periodId, null, {
      incumbentUserId: preparation.incumbentUserId,
      replacementUserId: preparation.replacementUserId,
      periodStart: preparation.periodStart,
      periodEnd: preparation.periodEnd,
      grossAmountCents: preparation.grossAmountCents,
      rate: preparation.rate,
      amountCents,
      status: "draft",
    });
    return { periodId: preparation.periodId, amountCents, status: "draft" as const, requiresValidation: true };
  }

  public async previewReassignment(organizationId: string, actor: Actor, rawInput: VisitReassignmentPreview) {
    assertCanSchedule(actor.role);
    const input = visitReassignmentPreviewSchema.parse(rawInput);
    const visit = await this.repository.getVisitAssignment(organizationId, input.visitId);
    if (visit === null) throw new DomainError("VISIT_NOT_FOUND", "Passage introuvable.");
    if (visit.status !== "planned") throw new DomainError("VISIT_REASSIGNMENT_FORBIDDEN", "Seul un passage planifié peut être réaffecté.");
    if (visit.assignedUserId === input.toUserId) throw new DomainError("VISIT_ALREADY_ASSIGNED", "Ce passage est déjà affecté à cette IDEL.");
    const change: AssignmentChange = {
      id: input.changeId,
      organizationId,
      visitId: input.visitId,
      fromUserId: visit.assignedUserId,
      toUserId: input.toUserId,
      reason: input.reason,
      status: "proposed",
      proposedByUserId: actor.userId,
      createdAt: this.now(),
    };
    await this.repository.createAssignmentChange(change);
    return {
      changeId: change.id,
      requiresConfirmation: true,
      diff: {
        visitId: change.visitId,
        scheduledAt: visit.scheduledAt,
        fromUserId: change.fromUserId,
        toUserId: change.toUserId,
      },
    };
  }

  public async applyReassignment(organizationId: string, actor: Actor, changeId: string) {
    assertCanSchedule(actor.role);
    const change = await this.repository.getAssignmentChange(organizationId, changeId);
    if (change === null) throw new DomainError("ASSIGNMENT_CHANGE_NOT_FOUND", "Proposition de réaffectation introuvable.");
    if (change.status !== "proposed") throw new DomainError("ASSIGNMENT_CHANGE_ALREADY_HANDLED", "Cette proposition a déjà été traitée.");
    await this.repository.applyAssignmentChange(organizationId, change.id, actor.userId);
    await this.writeAudit(organizationId, actor, "visit.reassigned", change.visitId, {
      assignedUserId: change.fromUserId,
    }, {
      assignedUserId: change.toUserId,
      changeId: change.id,
      reason: change.reason,
    });
    return { changeId: change.id, status: "applied" as const, visitId: change.visitId };
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
        resourceType: "cabinet",
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

function assertCanManageCabinet(role: OrganizationRole): void {
  if (role !== "owner") throw new DomainError("CABINET_MANAGEMENT_FORBIDDEN", "Cette action est réservée à la titulaire du cabinet.");
}

function assertCanSchedule(role: OrganizationRole): void {
  if (role === "remplacant") throw new DomainError("SCHEDULE_MANAGEMENT_FORBIDDEN", "La réaffectation est réservée au cabinet.");
}
