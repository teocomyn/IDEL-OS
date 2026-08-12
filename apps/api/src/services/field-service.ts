import { buildAuditRecord, type EncryptionService } from "@idel-os/db";
import { recalculateTimeline } from "@idel-os/routing";
import {
  DomainError,
  visitExceptionInputSchema,
  type EncryptedValue,
  type OrganizationRole,
  type VisitExceptionInput,
} from "@idel-os/shared";

import type { AuditSink } from "./patient-service.js";
import { parisTimeOnInstantDay } from "./paris-time.js";

type Actor = { userId: string; role: OrganizationRole };

export type StoredTodayVisit = {
  id: string;
  patientId: string;
  assignedUserId: string | null;
  scheduledAt: Date;
  timeWindowStart: string | null;
  timeWindowEnd: string | null;
  estimatedDurationMin: number;
  status: "planned" | "in_progress" | "done" | "missed" | "cancelled" | "refused";
  positionInTour: number | null;
  firstNameEnc: EncryptedValue;
  lastNameEnc: EncryptedValue;
  addressLineEnc: EncryptedValue;
  postalCode: string;
  city: string;
  geo: { x: number; y: number } | null;
  acts: Array<{ id: string; label: string; performed: boolean }>;
};

export type StoredVisitException = {
  organizationId: string;
  visitId: string;
  recordedByUserId: string;
  idempotencyKey: string;
  type: VisitExceptionInput["type"];
  noteEnc: EncryptedValue | null;
  previousScheduledAt: Date;
  rescheduledAt: Date | null;
  resultingStatus: StoredTodayVisit["status"];
};

export interface FieldRepository {
  listToday(organizationId: string, assignedUserId: string, date: string): Promise<StoredTodayVisit[]>;
  findAssignedVisit(organizationId: string, assignedUserId: string, visitId: string): Promise<StoredTodayVisit | null>;
  recordException(exception: StoredVisitException): Promise<boolean>;
}

export class FieldService {
  public constructor(
    private readonly repository: FieldRepository,
    private readonly audit: AuditSink,
    private readonly encryption: EncryptionService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async today(organizationId: string, actor: Actor, date: string) {
    this.assertNurse(actor);
    const stored = await this.repository.listToday(organizationId, actor.userId, date);
    const active = stored.filter(({ status }) => !["done", "missed", "cancelled", "refused"].includes(status));
    let previousCoordinates: StoredTodayVisit["geo"] = null;
    const timeline = recalculateTimeline({
      anchorAt: this.now(),
      stops: active.map((visit) => {
        const travelFromPreviousS = estimateTravelSeconds(previousCoordinates, visit.geo);
        previousCoordinates = visit.geo;
        return {
          id: visit.id,
          plannedAt: visit.scheduledAt,
          windowStart: toWindowDate(visit.scheduledAt, visit.timeWindowStart),
          windowEnd: toWindowDate(visit.scheduledAt, visit.timeWindowEnd),
          serviceDurationMin: visit.estimatedDurationMin,
          travelFromPreviousS,
          status: visit.status,
        };
      }),
    });
    const timelineById = new Map(timeline.map((entry) => [entry.id, entry]));
    return Promise.all(stored.map(async (visit) => {
      const [firstName, lastName, addressLine] = await Promise.all([
        this.encryption.decrypt(organizationId, visit.firstNameEnc),
        this.encryption.decrypt(organizationId, visit.lastNameEnc),
        this.encryption.decrypt(organizationId, visit.addressLineEnc),
      ]);
      const timing = timelineById.get(visit.id);
      return {
        id: visit.id,
        patientId: visit.patientId,
        patientDisplayName: `${firstName} ${lastName}`,
        address: `${addressLine}, ${visit.postalCode} ${visit.city}`,
        coordinates: visit.geo === null ? null : { latitude: visit.geo.y, longitude: visit.geo.x },
        scheduledAt: visit.scheduledAt,
        estimatedArrivalAt: timing?.estimatedArrivalAt ?? visit.scheduledAt,
        travelFromPreviousMin: Math.ceil((timing?.travelFromPreviousS ?? 0) / 60),
        delayMin: timing?.delayMin ?? 0,
        windowViolationMin: timing?.windowViolationMin ?? 0,
        estimatedDurationMin: visit.estimatedDurationMin,
        status: visit.status,
        positionInTour: visit.positionInTour,
        acts: visit.acts,
      };
    }));
  }

  public async recordException(command: {
    organizationId: string;
    actor: Actor;
    input: VisitExceptionInput;
  }): Promise<{ visitId: string; applied: boolean }> {
    this.assertNurse(command.actor);
    const input = visitExceptionInputSchema.parse(command.input);
    const existing = await this.repository.findAssignedVisit(command.organizationId, command.actor.userId, input.visitId);
    if (existing === null) throw new DomainError("VISIT_NOT_FOUND", "Passage introuvable ou non affecté.");
    const resultingStatus = exceptionStatus(input.type);
    const applied = await this.repository.recordException({
      organizationId: command.organizationId,
      visitId: input.visitId,
      recordedByUserId: command.actor.userId,
      idempotencyKey: input.idempotencyKey,
      type: input.type,
      noteEnc: input.note === null ? null : await this.encryption.encrypt(command.organizationId, input.note),
      previousScheduledAt: existing.scheduledAt,
      rescheduledAt: input.rescheduledAt === undefined ? null : new Date(input.rescheduledAt),
      resultingStatus,
    });
    if (applied) {
      await this.audit.append({
        organizationId: command.organizationId,
        ...buildAuditRecord({
          actorUserId: command.actor.userId,
          actorRole: command.actor.role,
          action: `visit.exception.${input.type}`,
          resourceType: "visit",
          resourceId: input.visitId,
          before: { status: existing.status, scheduledAt: existing.scheduledAt },
          after: { status: resultingStatus, rescheduledAt: input.rescheduledAt ?? null },
          aiProposalId: null,
          ip: null,
          userAgent: null,
        }),
      });
    }
    return { visitId: input.visitId, applied };
  }

  private assertNurse(actor: Actor): void {
    if (actor.role === "secretaire") {
      throw new DomainError("FIELD_FORBIDDEN", "Seul un professionnel infirmier accède à la tournée.");
    }
  }
}

function exceptionStatus(type: VisitExceptionInput["type"]): StoredTodayVisit["status"] {
  if (type === "absence") return "missed";
  if (type === "refusal") return "refused";
  if (type === "reschedule") return "planned";
  return "cancelled";
}

function toWindowDate(date: Date, time: string | null): Date {
  if (time === null) return date;
  return parisTimeOnInstantDay(date, time);
}

/** Estimation prudente de secours. Le fournisseur cartographique pourra la remplacer sans changer le contrat mobile. */
function estimateTravelSeconds(
  previous: StoredTodayVisit["geo"],
  current: StoredTodayVisit["geo"],
): number {
  if (previous === null || current === null) return 0;
  const earthRadiusKm = 6_371;
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(current.y - previous.y);
  const longitudeDelta = toRadians(current.x - previous.x);
  const startLatitude = toRadians(previous.y);
  const endLatitude = toRadians(current.y);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  const distanceKm = earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  const urbanRoadDistanceKm = distanceKm * 1.3;
  return Math.max(180, Math.ceil(urbanRoadDistanceKm / 25 * 3_600));
}
