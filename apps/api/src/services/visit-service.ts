import { buildAuditRecord } from "@idel-os/db";
import { DomainError, type OrganizationRole } from "@idel-os/shared";

import type { AuditSink } from "./patient-service.js";

export type VisitLifecycleStatus = "planned" | "in_progress" | "done" | "missed" | "cancelled" | "refused";

export type StoredVisitLifecycle = {
  id: string;
  organizationId: string;
  patientId: string;
  assignedUserId: string | null;
  status: VisitLifecycleStatus;
  startedAt: Date | null;
  endedAt: Date | null;
  acts: Array<{ id: string; performed: boolean }>;
};

export interface VisitLifecycleRepository {
  findById(organizationId: string, visitId: string): Promise<StoredVisitLifecycle | null>;
  updateVisit(visit: StoredVisitLifecycle): Promise<void>;
  setActPerformed(organizationId: string, visitActId: string, performed: boolean): Promise<void>;
}

type Actor = { userId: string; role: OrganizationRole };

export class VisitService {
  public constructor(
    private readonly repository: VisitLifecycleRepository,
    private readonly audit: AuditSink,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async start(command: { organizationId: string; actor: Actor; visitId: string }): Promise<StoredVisitLifecycle> {
    const visit = await this.getNurseVisit(command.organizationId, command.actor, command.visitId);
    if (visit.status === "in_progress") return visit;
    if (visit.status !== "planned") {
      throw new DomainError("VISIT_NOT_PLANNED", "Seul un passage planifié peut être démarré.");
    }
    const updated = { ...visit, status: "in_progress" as const, startedAt: this.now() };
    await this.repository.updateVisit(updated);
    await this.writeAudit(command.organizationId, command.actor, updated.id, "visit.started", visit, updated);
    return updated;
  }

  public async setActPerformed(command: {
    organizationId: string;
    actor: Actor;
    visitId: string;
    visitActId: string;
    performed: boolean;
  }): Promise<StoredVisitLifecycle> {
    const visit = await this.getNurseVisit(command.organizationId, command.actor, command.visitId);
    if (visit.status === "done") return visit;
    if (visit.status !== "in_progress") {
      throw new DomainError("VISIT_NOT_IN_PROGRESS", "Démarrez le passage avant de valider les actes.");
    }
    const act = visit.acts.find(({ id }) => id === command.visitActId);
    if (act === undefined) throw new DomainError("VISIT_ACT_NOT_FOUND", "Acte du passage introuvable.");
    await this.repository.setActPerformed(command.organizationId, command.visitActId, command.performed);
    return {
      ...visit,
      acts: visit.acts.map((current) => current.id === command.visitActId
        ? { ...current, performed: command.performed }
        : current),
    };
  }

  public async complete(command: { organizationId: string; actor: Actor; visitId: string }): Promise<StoredVisitLifecycle> {
    const visit = await this.getNurseVisit(command.organizationId, command.actor, command.visitId);
    if (visit.status === "done") return visit;
    if (visit.status !== "in_progress") {
      throw new DomainError("VISIT_NOT_IN_PROGRESS", "Ce passage n’est pas en cours.");
    }
    if (visit.acts.length === 0 || visit.acts.some(({ performed }) => !performed)) {
      throw new DomainError("VISIT_ACTS_INCOMPLETE", "Confirmez chaque acte avant de terminer le passage.");
    }
    const updated = { ...visit, status: "done" as const, endedAt: this.now() };
    await this.repository.updateVisit(updated);
    await this.writeAudit(command.organizationId, command.actor, updated.id, "visit.completed", visit, updated);
    return updated;
  }

  private async getNurseVisit(
    organizationId: string,
    actor: Actor,
    visitId: string,
  ): Promise<StoredVisitLifecycle> {
    if (actor.role === "secretaire") {
      throw new DomainError("VISIT_FORBIDDEN", "Seul un professionnel infirmier peut réaliser un passage.");
    }
    const visit = await this.repository.findById(organizationId, visitId);
    if (visit === null) throw new DomainError("VISIT_NOT_FOUND", "Passage introuvable.");
    if (visit.assignedUserId !== null && visit.assignedUserId !== actor.userId) {
      throw new DomainError("VISIT_ASSIGNED_TO_OTHER", "Ce passage est affecté à un autre professionnel.");
    }
    return visit;
  }

  private async writeAudit(
    organizationId: string,
    actor: Actor,
    visitId: string,
    action: string,
    before: StoredVisitLifecycle,
    after: StoredVisitLifecycle,
  ): Promise<void> {
    await this.audit.append({
      organizationId,
      ...buildAuditRecord({
        actorUserId: actor.userId,
        actorRole: actor.role,
        action,
        resourceType: "visit",
        resourceId: visitId,
        before: { status: before.status, startedAt: before.startedAt, endedAt: before.endedAt },
        after: { status: after.status, startedAt: after.startedAt, endedAt: after.endedAt },
        aiProposalId: null,
        ip: null,
        userAgent: null,
      }),
    });
  }
}
