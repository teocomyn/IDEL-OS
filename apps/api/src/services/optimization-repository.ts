import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";

import {
  optimizationRuns,
  patients,
  tours,
  visits,
  type Database,
  withOrganization,
} from "@idel-os/db";
import type {
  FieldNurse,
  FieldRoutingPlan,
  FieldRoutingStop,
  GeoCoordinate,
} from "@idel-os/routing";
import { DomainError, type RoutingProposalInput } from "@idel-os/shared";

import type {
  OptimizationRepository,
  StoredOptimizationProposal,
} from "./optimization-service.js";
import { parisDayBounds } from "./paris-time.js";

type TourConstraints = {
  shiftStart?: string;
  shiftEnd?: string;
  skills?: number[];
  maxVisits?: number;
  breaks?: Array<{ id?: string; durationS?: number; timeWindows?: Array<[string, string]> }>;
  specialStops?: Array<{
    id: string;
    longitude: number;
    latitude: number;
    serviceDurationS?: number;
    timeWindows?: Array<[string, string]>;
    kind?: "laboratory" | "cabinet";
    lockedNurseId?: string | null;
  }>;
};

type VisitConstraints = {
  requiredSkills?: number[];
  priority?: number;
  continuityNurseId?: string | null;
  lockedNurseId?: string | null;
  lockedPosition?: number | null;
  minimumIntervalWindow?: [string, string];
};

export class DrizzleOptimizationRepository implements OptimizationRepository {
  public constructor(private readonly database: Database) {}

  public async loadPlan(organizationId: string, input: RoutingProposalInput) {
    const { start, end } = parisDayBounds(input.date);
    return withOrganization(this.database, organizationId, async (transaction) => {
      const dayTours = await transaction.select().from(tours).where(and(
        eq(tours.orgId, organizationId),
        eq(tours.date, input.date),
      ));
      const usableTours = dayTours.filter((tour) =>
        tour.assignedUserId !== null && tour.startLocation !== null && tour.endLocation !== null,
      );
      if (usableTours.length === 0) {
        throw new DomainError(
          "ROUTING_CONFIGURATION_INCOMPLETE",
          "Ajoutez une IDEL et les coordonnées de départ/retour à au moins une tournée.",
        );
      }
      const visitRows = await transaction.select({ visit: visits, geo: patients.geo })
        .from(visits)
        .innerJoin(patients, and(eq(patients.orgId, organizationId), eq(patients.id, visits.patientId)))
        .where(and(
          eq(visits.orgId, organizationId),
          gte(visits.scheduledAt, start),
          lt(visits.scheduledAt, end),
          inArray(visits.status, ["planned"]),
        ))
        .orderBy(asc(visits.positionInTour), asc(visits.scheduledAt));
      const missingGeo = visitRows.filter(({ geo }) => geo === null).length;
      if (missingGeo > 0) {
        throw new DomainError("ROUTING_MISSING_GEO", `${missingGeo} patient(s) n’ont pas de coordonnées validées.`);
      }

      const nurses: FieldNurse[] = usableTours.map((tour) => {
        const constraints = asTourConstraints(tour.constraintsJson);
        return {
          id: tour.assignedUserId!,
          start: coordinate(tour.startLocation!),
          end: coordinate(tour.endLocation!),
          shift: [
            Math.max(seconds(constraints.shiftStart ?? "06:00"), parisSeconds(input.anchorAt)),
            seconds(constraints.shiftEnd ?? "14:00"),
          ],
          skills: validSkills(constraints.skills),
          maxVisits: integerInRange(constraints.maxVisits, 1, 100, 30),
          breaks: (constraints.breaks ?? []).map((item, index) => ({
            id: item.id ?? `pause-${index + 1}`,
            durationS: integerInRange(item.durationS, 60, 14_400, 1_200),
            timeWindows: (item.timeWindows ?? [["11:30", "13:30"]]).map(([from, to]) => [seconds(from), seconds(to)]),
          })),
        };
      });

      const patientStops: FieldRoutingStop[] = visitRows.map(({ visit, geo }) => {
        const constraints = asVisitConstraints(visit.routingConstraintsJson);
        const regularWindows = visit.timeWindowStart === null || visit.timeWindowEnd === null
          ? []
          : [[seconds(visit.timeWindowStart), seconds(visit.timeWindowEnd)] as [number, number]];
        const intervalWindows = constraints.minimumIntervalWindow === undefined
          ? regularWindows
          : [[seconds(constraints.minimumIntervalWindow[0]), seconds(constraints.minimumIntervalWindow[1])] as [number, number]];
        return {
          id: visit.id,
          patientId: visit.patientId,
          coordinate: coordinate(geo!),
          serviceDurationS: visit.estimatedDurationMin * 60,
          timeWindows: visit.hardTimeWindow ? intervalWindows : widenWindows(intervalWindows, 30 * 60),
          priority: integerInRange(constraints.priority, 0, 100, 50),
          requiredSkills: validSkills(constraints.requiredSkills),
          preferredNurseId: visit.preferredUserId,
          continuityNurseId: constraints.continuityNurseId ?? visit.preferredUserId,
          lockedNurseId: input.lockedVisitIds.includes(visit.id)
            ? visit.assignedUserId
            : constraints.lockedNurseId ?? null,
          lockedPosition: input.lockedVisitIds.includes(visit.id)
            ? visit.positionInTour
            : constraints.lockedPosition ?? null,
          kind: "patient",
        };
      });

      const specialStops = usableTours.flatMap((tour) => {
        const constraints = asTourConstraints(tour.constraintsJson);
        return (constraints.specialStops ?? []).map<FieldRoutingStop>((stop) => ({
          id: stop.id,
          patientId: null,
          coordinate: { longitude: stop.longitude, latitude: stop.latitude },
          serviceDurationS: integerInRange(stop.serviceDurationS, 0, 14_400, 600),
          timeWindows: (stop.timeWindows ?? []).map(([from, to]) => [seconds(from), seconds(to)]),
          priority: 100,
          requiredSkills: [],
          preferredNurseId: stop.lockedNurseId ?? tour.assignedUserId,
          continuityNurseId: null,
          lockedNurseId: stop.lockedNurseId ?? tour.assignedUserId,
          lockedPosition: null,
          kind: stop.kind ?? "laboratory",
        }));
      });
      const balancedMaximum = Math.max(1, Math.ceil((patientStops.length + specialStops.length) / nurses.length) + 1);
      for (const nurse of nurses) nurse.maxVisits = Math.min(nurse.maxVisits, balancedMaximum);

      const currentAssignments = usableTours.map((tour) => ({
        nurseId: tour.assignedUserId!,
        stopIds: patientStops
          .filter((stop) => visitRows.find(({ visit }) => visit.id === stop.id)?.visit.tourId === tour.id)
          .sort((left, right) => {
            const leftPosition = visitRows.find(({ visit }) => visit.id === left.id)?.visit.positionInTour ?? 999;
            const rightPosition = visitRows.find(({ visit }) => visit.id === right.id)?.visit.positionInTour ?? 999;
            return leftPosition - rightPosition;
          })
          .map(({ id }) => id),
        durationS: tour.plannedDurationS ?? 0,
        distanceM: tour.plannedDistanceM ?? 0,
      }));
      const plan: FieldRoutingPlan = { nurses, stops: [...patientStops, ...specialStops], currentAssignments };
      return { anchorTourId: usableTours[0]!.id, plan };
    });
  }

  public async saveProposal(proposal: StoredOptimizationProposal): Promise<void> {
    await withOrganization(this.database, proposal.organizationId, async (transaction) => {
      await transaction.insert(optimizationRuns).values({
        id: proposal.id,
        orgId: proposal.organizationId,
        tourId: proposal.anchorTourId,
        algorithm: "vroom+osrm",
        paramsJson: { date: proposal.date },
        beforeMetrics: proposal.diff.before,
        afterMetrics: proposal.diff.after,
        proposalJson: proposal,
        accepted: false,
      });
    });
  }

  public async findProposal(organizationId: string, optimizationRunId: string): Promise<StoredOptimizationProposal | null> {
    return withOrganization(this.database, organizationId, async (transaction) => {
      const [row] = await transaction.select().from(optimizationRuns).where(and(
        eq(optimizationRuns.orgId, organizationId),
        eq(optimizationRuns.id, optimizationRunId),
      )).limit(1);
      if (row === undefined) return null;
      const proposal = row.proposalJson as StoredOptimizationProposal;
      return { ...proposal, accepted: row.accepted };
    });
  }

  public async applyProposal(
    organizationId: string,
    optimizationRunId: string,
    acceptedByUserId: string,
  ): Promise<void> {
    await withOrganization(this.database, organizationId, async (transaction) => {
      const [run] = await transaction.select().from(optimizationRuns).where(and(
        eq(optimizationRuns.orgId, organizationId),
        eq(optimizationRuns.id, optimizationRunId),
      )).limit(1).for("update");
      if (run === undefined) throw new DomainError("ROUTING_PROPOSAL_NOT_FOUND", "Proposition introuvable.");
      if (run.accepted) throw new DomainError("ROUTING_ALREADY_APPLIED", "Cette proposition a déjà été appliquée.");
      const proposal = run.proposalJson as StoredOptimizationProposal;
      const patientVisitIds = proposal.plan.stops.filter(({ patientId }) => patientId !== null).map(({ id }) => id);
      const currentVisits = patientVisitIds.length === 0 ? [] : await transaction.select({
        id: visits.id,
        assignedUserId: visits.assignedUserId,
        positionInTour: visits.positionInTour,
        status: visits.status,
      }).from(visits).where(and(
        eq(visits.orgId, organizationId),
        inArray(visits.id, patientVisitIds),
      ));
      const expected = new Map(proposal.plan.currentAssignments.flatMap((assignment) =>
        assignment.stopIds.map((visitId, position) => [
          visitId,
          { assignedUserId: assignment.nurseId, positionInTour: position },
        ] as const),
      ));
      const stale = currentVisits.length !== patientVisitIds.length || currentVisits.some((visit) => {
        const snapshot = expected.get(visit.id);
        return visit.status !== "planned"
          || visit.assignedUserId !== (snapshot?.assignedUserId ?? null)
          || visit.positionInTour !== (snapshot?.positionInTour ?? null);
      });
      if (stale) {
        throw new DomainError(
          "ROUTING_PROPOSAL_STALE",
          "La tournée a changé depuis le calcul. Relancez l’optimisation pour afficher un nouveau diff.",
        );
      }
      const dayTours = await transaction.select().from(tours).where(and(
        eq(tours.orgId, organizationId),
        eq(tours.date, proposal.date),
      ));
      const tourByNurse = new Map(dayTours.flatMap((tour) =>
        tour.assignedUserId === null ? [] : [[tour.assignedUserId, tour] as const],
      ));
      for (const assignment of proposal.solution.assignments) {
        const tour = tourByNurse.get(assignment.nurseId);
        if (tour === undefined) throw new DomainError("ROUTING_TOUR_CHANGED", "La composition des tournées a changé. Relancez l’optimisation.");
        await transaction.update(tours).set({
          optimizationRunId,
          plannedDurationS: assignment.durationS,
          plannedDistanceM: assignment.distanceM,
        }).where(and(eq(tours.orgId, organizationId), eq(tours.id, tour.id)));
        for (const [position, visitId] of assignment.stopIds.entries()) {
          const isPatientVisit = proposal.plan.stops.find(({ id }) => id === visitId)?.patientId !== null;
          if (!isPatientVisit) continue;
          await transaction.update(visits).set({
            tourId: tour.id,
            assignedUserId: assignment.nurseId,
            positionInTour: position,
          }).where(and(eq(visits.orgId, organizationId), eq(visits.id, visitId)));
        }
      }
      await transaction.update(optimizationRuns).set({
        accepted: true,
        acceptedByUserId,
        acceptedAt: new Date(),
      }).where(and(eq(optimizationRuns.orgId, organizationId), eq(optimizationRuns.id, optimizationRunId)));
    });
  }
}

function coordinate(value: { x: number; y: number }): GeoCoordinate {
  return { longitude: value.x, latitude: value.y };
}

function seconds(value: string): number {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (match === null) throw new DomainError("ROUTING_INVALID_TIME", `Horaire invalide : ${value}.`);
  return Number(match[1]) * 3_600 + Number(match[2]) * 60;
}

function parisSeconds(value: string | undefined): number {
  if (value === undefined) return 0;
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return get("hour") * 3_600 + get("minute") * 60 + get("second");
}

function widenWindows(windows: Array<[number, number]>, margin: number): Array<[number, number]> {
  return windows.map(([from, to]) => [Math.max(0, from - margin), Math.min(86_399, to + margin)]);
}

function integerInRange(value: unknown, minimum: number, maximum: number, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum ? value : fallback;
}

function validSkills(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((skill): skill is number => Number.isInteger(skill) && skill >= 0 && skill < 1_000_000)
    : [];
}

function asTourConstraints(value: unknown): TourConstraints {
  return typeof value === "object" && value !== null ? value : {};
}

function asVisitConstraints(value: unknown): VisitConstraints {
  return typeof value === "object" && value !== null ? value : {};
}
