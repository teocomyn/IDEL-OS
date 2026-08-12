import { randomUUID } from "node:crypto";

import { buildAuditRecord } from "@idel-os/db";
import { generateVisitSchedule } from "@idel-os/routing";
import {
  carePlanActivationInputSchema,
  DomainError,
  type CarePlanActivationInput,
  type OrganizationRole,
} from "@idel-os/shared";

import type { AuditSink } from "./patient-service.js";

export type StoredCarePlanActivation = {
  organizationId: string;
  carePlanId: string;
  patientId: string;
  prescriptionId: string;
  name: string;
  startDate: string;
  endDate: string;
  items: Array<{
    id: string;
    prescriptionItemId: string | null;
    actCatalogId: string;
    estimatedDurationMin: number;
    requiresTwoNurses: boolean;
  }>;
  visits: Array<{
    id: string;
    patientId: string;
    carePlanId: string;
    carePlanItemIds: string[];
    scheduledAt: Date;
    timeWindowStart: string;
    timeWindowEnd: string;
    estimatedDurationMin: number;
  }>;
};

export type CarePlanActivationResult = {
  carePlanId: string;
  status: "active";
  itemCount: number;
  visitCount: number;
  firstVisitAt: Date | null;
  lastVisitAt: Date | null;
};

export interface CarePlanRepository {
  isValidatedPrescription(organizationId: string, prescriptionId: string, patientId: string): Promise<boolean>;
  activate(plan: StoredCarePlanActivation): Promise<void>;
}

export class CarePlanService {
  public constructor(
    private readonly repository: CarePlanRepository,
    private readonly audit: AuditSink,
  ) {}

  public async activate(command: {
    organizationId: string;
    actor: { userId: string; role: OrganizationRole };
    input: CarePlanActivationInput;
  }): Promise<CarePlanActivationResult> {
    if (command.actor.role === "secretaire") {
      throw new DomainError("CARE_PLAN_FORBIDDEN", "Seul un professionnel infirmier peut valider ce plan.");
    }
    const input = carePlanActivationInputSchema.parse(command.input);
    const prescriptionIsValidated = await this.repository.isValidatedPrescription(
      command.organizationId,
      input.prescriptionId,
      input.patientId,
    );
    if (!prescriptionIsValidated) {
      throw new DomainError(
        "PRESCRIPTION_NOT_VALIDATED",
        "L’ordonnance doit être relue et validée avant de créer les passages.",
      );
    }

    const plannedVisits = generateVisitSchedule({
      patientId: input.patientId,
      startDate: input.startDate,
      endDate: input.endDate,
      items: input.items.map(({ id, label, estimatedDurationMin, frequency }) => ({
        id,
        label,
        estimatedDurationMin,
        frequency,
      })),
    });
    const stored: StoredCarePlanActivation = {
      organizationId: command.organizationId,
      carePlanId: input.carePlanId,
      patientId: input.patientId,
      prescriptionId: input.prescriptionId,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      items: input.items.map(({ id, prescriptionItemId, actCatalogId, estimatedDurationMin, requiresTwoNurses }) => ({
        id,
        prescriptionItemId,
        actCatalogId,
        estimatedDurationMin,
        requiresTwoNurses,
      })),
      visits: plannedVisits.map((visit) => ({
        id: randomUUID(),
        patientId: input.patientId,
        carePlanId: input.carePlanId,
        carePlanItemIds: visit.careItems.map(({ id }) => id),
        scheduledAt: toScheduledDate(visit.date, visit.timeWindow.start),
        timeWindowStart: visit.timeWindow.start,
        timeWindowEnd: visit.timeWindow.end,
        estimatedDurationMin: visit.estimatedDurationMin,
      })),
    };
    await this.repository.activate(stored);

    const firstVisitAt = stored.visits[0]?.scheduledAt ?? null;
    const lastVisitAt = stored.visits.at(-1)?.scheduledAt ?? null;
    await this.audit.append({
      organizationId: command.organizationId,
      ...buildAuditRecord({
        actorUserId: command.actor.userId,
        actorRole: command.actor.role,
        action: "care_plan.activated",
        resourceType: "care_plan",
        resourceId: input.carePlanId,
        before: null,
        after: {
          prescriptionId: input.prescriptionId,
          itemCount: input.items.length,
          visitCount: stored.visits.length,
          startDate: input.startDate,
          endDate: input.endDate,
        },
        aiProposalId: null,
        ip: null,
        userAgent: null,
      }),
    });
    return {
      carePlanId: input.carePlanId,
      status: "active",
      itemCount: input.items.length,
      visitCount: stored.visits.length,
      firstVisitAt,
      lastVisitAt,
    };
  }
}

function toScheduledDate(date: string, time: string): Date {
  return new Date(`${date}T${time}:00.000Z`);
}
