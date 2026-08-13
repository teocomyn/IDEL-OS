import {
  carePlanScheduleInputSchema,
  type CarePlanScheduleInput,
  type CareTimeWindow,
} from "@idel-os/shared";

export type PlannedVisit = {
  id: string;
  patientId: string;
  careItems: Array<{
    id: string;
    label: string;
    estimatedDurationMin: number;
  }>;
  date: string;
  timeWindow: CareTimeWindow;
  estimatedDurationMin: number;
};

export type TravelMetric = { distanceM: number; durationS: number };
export type TravelMatrix = Record<string, Record<string, TravelMetric | undefined> | undefined>;
export type RouteStop = {
  id: string;
  serviceDurationMin: number;
  windowStartMin: number;
  windowEndMin: number;
};
export type RouteOptimizationInput = {
  currentOrder: string[];
  stops: RouteStop[];
  matrix: TravelMatrix;
  startId: string;
  endId: string;
  departureMinute: number;
  lockedStopIds: string[];
};
export type RouteMetrics = {
  distanceM: number;
  travelDurationS: number;
  waitingDurationS: number;
  serviceDurationS: number;
  totalDurationS: number;
  windowViolationMin: number;
};
export type RouteOptimizationProposal = {
  currentOrder: string[];
  proposedOrder: string[];
  lockedStopIds: string[];
  movedStopIds: string[];
  before: RouteMetrics;
  after: RouteMetrics;
  distanceGainM: number;
  durationGainS: number;
};

export type GeoCoordinate = { longitude: number; latitude: number };
export type FieldNurse = {
  id: string;
  start: GeoCoordinate;
  end: GeoCoordinate;
  shift: [number, number];
  skills: number[];
  maxVisits: number;
  breaks: Array<{ id: string; durationS: number; timeWindows: Array<[number, number]> }>;
};
export type FieldRoutingStop = {
  id: string;
  patientId: string | null;
  coordinate: GeoCoordinate;
  serviceDurationS: number;
  timeWindows: Array<[number, number]>;
  priority: number;
  requiredSkills: number[];
  preferredNurseId: string | null;
  continuityNurseId: string | null;
  lockedNurseId: string | null;
  lockedPosition: number | null;
  kind: "patient" | "laboratory" | "cabinet";
};
export type FieldRoutingPlan = {
  nurses: FieldNurse[];
  stops: FieldRoutingStop[];
  currentAssignments: Array<{ nurseId: string; stopIds: string[]; durationS?: number; distanceM?: number }>;
};
export type FieldRoutingSolution = {
  assignments: Array<{ nurseId: string; stopIds: string[]; durationS: number; distanceM: number }>;
  unassignedStopIds: string[];
  metrics: { durationS: number; distanceM: number; continuityBreaks: number; loadImbalance: number };
};
export type FieldRoutingDiff = {
  moved: Array<{ stopId: string; fromNurseId: string | null; toNurseId: string; fromPosition: number | null; toPosition: number }>;
  before: FieldRoutingSolution["metrics"];
  after: FieldRoutingSolution["metrics"];
  gains: { durationS: number; distanceM: number };
};

export interface RoadMatrixProvider {
  table(coordinates: GeoCoordinate[]): Promise<{ durations: number[][]; distances: number[][] }>;
}

export interface VehicleOptimizer {
  solve(plan: FieldRoutingPlan, matrix: { durations: number[][]; distances: number[][] }): Promise<FieldRoutingSolution>;
}

export class OsrmHttpClient implements RoadMatrixProvider {
  public constructor(
    private readonly baseUrl: string,
    private readonly request: typeof fetch = fetch,
  ) {}

  public async table(coordinates: GeoCoordinate[]): Promise<{ durations: number[][]; distances: number[][] }> {
    if (coordinates.length === 0) return { durations: [], distances: [] };
    const serialized = coordinates.map(({ longitude, latitude }) => `${longitude},${latitude}`).join(";");
    const response = await this.request(`${this.baseUrl.replace(/\/$/, "")}/table/v1/driving/${serialized}?annotations=duration,distance`);
    if (!response.ok) throw new Error(`OSRM indisponible (${response.status}).`);
    const body = await response.json() as { code?: string; durations?: Array<Array<number | null>>; distances?: Array<Array<number | null>> };
    if (body.code !== "Ok" || body.durations === undefined || body.distances === undefined) throw new Error("Matrice OSRM invalide.");
    return {
      durations: completeMatrix(body.durations, "durée"),
      distances: completeMatrix(body.distances, "distance"),
    };
  }
}

export class VroomHttpClient implements VehicleOptimizer {
  public constructor(
    private readonly baseUrl: string,
    private readonly request: typeof fetch = fetch,
  ) {}

  public async solve(plan: FieldRoutingPlan, matrix: { durations: number[][]; distances: number[][] }): Promise<FieldRoutingSolution> {
    const locations = collectRoutingLocations(plan);
    const locationIndex = new Map(locations.map((coordinate, index) => [coordinateKey(coordinate), index]));
    const nurseIndex = new Map(plan.nurses.map((nurse, index) => [index + 1, nurse.id]));
    const stopByNumericId = new Map(plan.stops.map((stop, index) => [index + 1, stop]));
    const payload = {
      jobs: plan.stops.map((stop, index) => ({
        id: index + 1,
        location_index: locationIndex.get(coordinateKey(stop.coordinate)),
        service: stop.serviceDurationS,
        delivery: [1],
        priority: stop.priority,
        skills: [
          ...stop.requiredSkills,
          ...affinitySkills(plan, stop),
        ],
        ...(stop.timeWindows.length === 0 ? {} : { time_windows: stop.timeWindows }),
      })),
      vehicles: plan.nurses.map((nurse, index) => ({
        id: index + 1,
        start_index: locationIndex.get(coordinateKey(nurse.start)),
        end_index: locationIndex.get(coordinateKey(nurse.end)),
        time_window: nurse.shift,
        capacity: [nurse.maxVisits],
        skills: [...nurse.skills, nurseAffinitySkill(plan, nurse.id)],
        breaks: nurse.breaks.map((item, breakIndex) => ({ id: breakIndex + 1, service: item.durationS, time_windows: item.timeWindows })),
      })),
      matrices: { car: { durations: matrix.durations, distances: matrix.distances } },
    };
    const response = await this.request(this.baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`VROOM indisponible (${response.status}).`);
    const body = await response.json() as VroomResponse;
    if (body.code !== 0) throw new Error(`VROOM a refusé le problème (${body.error ?? body.code}).`);
    const assignments = body.routes.map((route) => ({
      nurseId: nurseIndex.get(route.vehicle) ?? `unknown:${route.vehicle}`,
      stopIds: route.steps.filter((step) => step.type === "job").map((step) => stopByNumericId.get(step.id)?.id).filter(isString),
      durationS: route.duration,
      distanceM: route.distance,
    }));
    assertLockedAssignments(plan, assignments);
    return {
      assignments,
      unassignedStopIds: body.unassigned.map(({ id }) => stopByNumericId.get(id)?.id).filter(isString),
      metrics: calculateSolutionMetrics(plan, assignments),
    };
  }
}

export function collectRoutingLocations(plan: FieldRoutingPlan): GeoCoordinate[] {
  const locations: GeoCoordinate[] = [];
  const seen = new Set<string>();
  for (const coordinate of [
    ...plan.nurses.flatMap(({ start, end }) => [start, end]),
    ...plan.stops.map(({ coordinate }) => coordinate),
  ]) {
    const key = coordinateKey(coordinate);
    if (seen.has(key)) continue;
    seen.add(key);
    locations.push(coordinate);
  }
  return locations;
}

/** Recalcule l'état initial avec la même matrice routière que la proposition. */
export function withRoadMetrics(
  plan: FieldRoutingPlan,
  matrix: { durations: number[][]; distances: number[][] },
): FieldRoutingPlan {
  const locations = collectRoutingLocations(plan);
  const locationIndex = new Map(locations.map((coordinate, index) => [coordinateKey(coordinate), index]));
  const stopById = new Map(plan.stops.map((stop) => [stop.id, stop]));
  return {
    ...plan,
    currentAssignments: plan.currentAssignments.map((assignment) => {
      const nurse = plan.nurses.find(({ id }) => id === assignment.nurseId);
      if (nurse === undefined) throw new Error(`IDEL affectée inconnue : ${assignment.nurseId}.`);
      const route = [
        nurse.start,
        ...assignment.stopIds.map((stopId) => {
          const stop = stopById.get(stopId);
          if (stop === undefined) throw new Error(`Passage affecté inconnu : ${stopId}.`);
          return stop.coordinate;
        }),
        nurse.end,
      ];
      let durationS = 0;
      let distanceM = 0;
      for (let index = 1; index < route.length; index += 1) {
        const from = locationIndex.get(coordinateKey(route[index - 1]!));
        const to = locationIndex.get(coordinateKey(route[index]!));
        if (from === undefined || to === undefined) throw new Error("Coordonnée absente de la matrice routière.");
        durationS += matrixValue(matrix.durations, from, to, "durée");
        distanceM += matrixValue(matrix.distances, from, to, "distance");
      }
      return { ...assignment, durationS, distanceM };
    }),
  };
}

function matrixValue(matrix: number[][], from: number, to: number, label: string): number {
  const value = matrix[from]?.[to];
  if (value === undefined || !Number.isFinite(value)) {
    throw new Error(`Matrice de ${label} incomplète entre ${from} et ${to}.`);
  }
  return value;
}

function assertLockedAssignments(
  plan: FieldRoutingPlan,
  assignments: Array<{ nurseId: string; stopIds: string[] }>,
): void {
  const proposed = assignmentIndex(assignments);
  for (const stop of plan.stops) {
    const assigned = proposed.get(stop.id);
    if (stop.lockedNurseId !== null && assigned?.nurseId !== stop.lockedNurseId) {
      throw new Error(`VROOM a déplacé le passage verrouillé ${stop.id} vers une autre IDEL.`);
    }
    if (stop.lockedPosition !== null && assigned?.position !== stop.lockedPosition) {
      throw new Error(`VROOM a déplacé le passage verrouillé ${stop.id} dans la tournée.`);
    }
  }
}

function completeMatrix(matrix: Array<Array<number | null>>, label: string): number[][] {
  return matrix.map((row, rowIndex) => row.map((value, columnIndex) => {
    if (value === null || !Number.isFinite(value)) throw new Error(`OSRM ne trouve aucune ${label} entre les points ${rowIndex + 1} et ${columnIndex + 1}.`);
    return Math.ceil(value);
  }));
}

function coordinateKey({ longitude, latitude }: GeoCoordinate): string {
  return `${longitude.toFixed(7)},${latitude.toFixed(7)}`;
}

function nurseAffinitySkill(plan: FieldRoutingPlan, nurseId: string): number {
  const index = plan.nurses.findIndex(({ id }) => id === nurseId);
  if (index < 0) throw new Error(`IDEL verrouillée inconnue : ${nurseId}.`);
  return 1_000_000 + index;
}

function affinitySkills(plan: FieldRoutingPlan, stop: FieldRoutingStop): number[] {
  const nurseId = stop.lockedNurseId ?? stop.continuityNurseId;
  return nurseId === null ? [] : [nurseAffinitySkill(plan, nurseId)];
}

function assignmentIndex(assignments: Array<{ nurseId: string; stopIds: string[] }>): Map<string, { nurseId: string; position: number }> {
  const result = new Map<string, { nurseId: string; position: number }>();
  for (const assignment of assignments) {
    assignment.stopIds.forEach((stopId, position) => result.set(stopId, { nurseId: assignment.nurseId, position }));
  }
  return result;
}

function calculateCurrentMetrics(plan: FieldRoutingPlan): FieldRoutingSolution["metrics"] {
  const assignments = plan.currentAssignments.map((assignment) => ({
    ...assignment,
    durationS: assignment.durationS ?? 0,
    distanceM: assignment.distanceM ?? 0,
  }));
  return calculateSolutionMetrics(plan, assignments);
}

function calculateSolutionMetrics(
  plan: FieldRoutingPlan,
  assignments: Array<{ nurseId: string; stopIds: string[]; durationS: number; distanceM: number }>,
): FieldRoutingSolution["metrics"] {
  const assignmentByStop = assignmentIndex(assignments);
  const continuityBreaks = plan.stops.filter((stop) => {
    const assigned = assignmentByStop.get(stop.id)?.nurseId;
    const expected = stop.continuityNurseId ?? stop.preferredNurseId;
    return expected !== null && assigned !== undefined && assigned !== expected;
  }).length;
  const loads = plan.nurses.map(({ id }) => assignments.find(({ nurseId }) => nurseId === id)?.stopIds.length ?? 0);
  const loadImbalance = loads.length === 0 ? 0 : Math.max(...loads) - Math.min(...loads);
  return {
    durationS: assignments.reduce((sum, route) => sum + route.durationS, 0),
    distanceM: assignments.reduce((sum, route) => sum + route.distanceM, 0),
    continuityBreaks,
    loadImbalance,
  };
}

function isString(value: string | undefined): value is string {
  return value !== undefined;
}

type VroomResponse = {
  code: number;
  error?: string;
  routes: Array<{ vehicle: number; duration: number; distance: number; steps: Array<{ type: string; id: number }> }>;
  unassigned: Array<{ id: number }>;
};

export function buildRoutingDiff(plan: FieldRoutingPlan, solution: FieldRoutingSolution): FieldRoutingDiff {
  const current = assignmentIndex(plan.currentAssignments);
  const proposed = assignmentIndex(solution.assignments);
  const moved = plan.stops.flatMap((stop) => {
    const before = current.get(stop.id) ?? null;
    const after = proposed.get(stop.id);
    if (after === undefined || (before?.nurseId === after.nurseId && before.position === after.position)) return [];
    return [{
      stopId: stop.id,
      fromNurseId: before?.nurseId ?? null,
      toNurseId: after.nurseId,
      fromPosition: before?.position ?? null,
      toPosition: after.position,
    }];
  });
  const before = calculateCurrentMetrics(plan);
  return {
    moved,
    before,
    after: solution.metrics,
    gains: { durationS: before.durationS - solution.metrics.durationS, distanceM: before.distanceM - solution.metrics.distanceM },
  };
}

export type TimelineStop = {
  id: string;
  plannedAt: Date;
  windowStart: Date;
  windowEnd: Date;
  serviceDurationMin: number;
  travelFromPreviousS: number;
  status: "planned" | "in_progress" | "done" | "missed" | "cancelled" | "refused";
};

export type RecalculatedStop = TimelineStop & {
  estimatedArrivalAt: Date;
  estimatedDepartureAt: Date;
  delayMin: number;
  windowViolationMin: number;
};

const MAX_SCHEDULE_DAYS = 366;

export function generateVisitSchedule(rawInput: CarePlanScheduleInput): PlannedVisit[] {
  const input = carePlanScheduleInputSchema.parse(rawInput);
  const start = parseDate(input.startDate);
  const end = parseDate(input.endDate);
  const horizonDays = differenceInDays(start, end) + 1;
  if (horizonDays > MAX_SCHEDULE_DAYS) {
    throw new Error(`La génération est limitée à ${MAX_SCHEDULE_DAYS} jours.`);
  }

  const occurrences: PlannedVisit[] = [];
  for (let offset = 0; offset < horizonDays; offset += 1) {
    const date = addDays(start, offset);
    const dateString = formatDate(date);
    for (const item of input.items) {
      if (item.frequency.kind === "as_needed") continue;
      const windows = item.frequency.kind === "daily"
        ? offset % item.frequency.everyNDays === 0 ? item.frequency.timeWindows : []
        : item.frequency.weekdays.includes(date.getUTCDay()) ? [item.frequency.timeWindow] : [];

      windows.forEach((timeWindow, windowIndex) => {
        occurrences.push({
          id: `${item.id}:${dateString}:${windowIndex}`,
          patientId: input.patientId,
          careItems: [{ id: item.id, label: item.label, estimatedDurationMin: item.estimatedDurationMin }],
          date: dateString,
          timeWindow,
          estimatedDurationMin: item.estimatedDurationMin,
        });
      });
    }
  }

  const sorted = occurrences.sort((left, right) =>
    `${left.date}T${left.timeWindow.start}`.localeCompare(`${right.date}T${right.timeWindow.start}`),
  );
  const visits: PlannedVisit[] = [];
  for (const occurrence of sorted) {
    const previous = visits.at(-1);
    if (previous !== undefined && previous.date === occurrence.date && windowsOverlap(previous.timeWindow, occurrence.timeWindow)) {
      previous.careItems.push(...occurrence.careItems);
      previous.estimatedDurationMin += occurrence.estimatedDurationMin;
      previous.timeWindow = {
        start: [previous.timeWindow.start, occurrence.timeWindow.start].sort().at(-1)!,
        end: [previous.timeWindow.end, occurrence.timeWindow.end].sort()[0]!,
      };
      previous.id = `${previous.id}+${occurrence.id}`;
    } else {
      visits.push(structuredClone(occurrence));
    }
  }
  return visits;
}

export function proposeRouteOptimization(input: RouteOptimizationInput): RouteOptimizationProposal {
  validateRouteInput(input);
  const locked = new Set(input.lockedStopIds);
  const before = evaluateRoute({ ...input, order: input.currentOrder });
  let bestOrder = [...input.currentOrder];
  let bestMetrics = before;

  for (let iteration = 0; iteration < 100; iteration += 1) {
    let improvedOrder = bestOrder;
    let improvedMetrics = bestMetrics;
    for (let left = 0; left < bestOrder.length; left += 1) {
      if (locked.has(bestOrder[left]!)) continue;
      for (let right = left + 1; right < bestOrder.length; right += 1) {
        if (locked.has(bestOrder[right]!)) continue;
        const candidate = [...bestOrder];
        [candidate[left], candidate[right]] = [candidate[right]!, candidate[left]!];
        const metrics = evaluateRoute({ ...input, order: candidate });
        if (compareMetrics(metrics, improvedMetrics) < 0) {
          improvedOrder = candidate;
          improvedMetrics = metrics;
        }
      }
    }
    if (improvedOrder === bestOrder) break;
    bestOrder = improvedOrder;
    bestMetrics = improvedMetrics;
  }

  return {
    currentOrder: [...input.currentOrder],
    proposedOrder: bestOrder,
    lockedStopIds: [...input.lockedStopIds],
    movedStopIds: input.currentOrder.filter((id, index) => bestOrder[index] !== id),
    before,
    after: bestMetrics,
    distanceGainM: before.distanceM - bestMetrics.distanceM,
    durationGainS: before.travelDurationS - bestMetrics.travelDurationS,
  };
}

export function evaluateRoute(input: RouteOptimizationInput & { order: string[] }): RouteMetrics {
  if (input.order.length === 0 && input.startId === input.endId) {
    return {
      distanceM: 0,
      travelDurationS: 0,
      waitingDurationS: 0,
      serviceDurationS: 0,
      totalDurationS: 0,
      windowViolationMin: 0,
    };
  }
  const stopById = new Map(input.stops.map((stop) => [stop.id, stop]));
  let previousId = input.startId;
  let currentMinute = input.departureMinute;
  let distanceM = 0;
  let travelDurationS = 0;
  let waitingDurationS = 0;
  let serviceDurationS = 0;
  let windowViolationMin = 0;

  for (const stopId of input.order) {
    const stop = stopById.get(stopId);
    if (stop === undefined) throw new Error(`Passage inconnu : ${stopId}.`);
    const travel = getTravel(input.matrix, previousId, stopId);
    distanceM += travel.distanceM;
    travelDurationS += travel.durationS;
    currentMinute += travel.durationS / 60;
    if (currentMinute < stop.windowStartMin) {
      waitingDurationS += (stop.windowStartMin - currentMinute) * 60;
      currentMinute = stop.windowStartMin;
    }
    if (currentMinute > stop.windowEndMin) windowViolationMin += currentMinute - stop.windowEndMin;
    currentMinute += stop.serviceDurationMin;
    serviceDurationS += stop.serviceDurationMin * 60;
    previousId = stopId;
  }

  const returnTravel = getTravel(input.matrix, previousId, input.endId);
  distanceM += returnTravel.distanceM;
  travelDurationS += returnTravel.durationS;
  return {
    distanceM,
    travelDurationS,
    waitingDurationS,
    serviceDurationS,
    totalDurationS: travelDurationS + waitingDurationS + serviceDurationS,
    windowViolationMin: Math.ceil(windowViolationMin),
  };
}

/** Recalcule les heures affichées après chaque événement terrain, sans réordonner silencieusement la tournée. */
export function recalculateTimeline(input: {
  anchorAt: Date;
  stops: TimelineStop[];
}): RecalculatedStop[] {
  let cursor = new Date(input.anchorAt);
  const result: RecalculatedStop[] = [];
  for (const stop of input.stops) {
    if (["done", "missed", "cancelled", "refused"].includes(stop.status)) continue;
    const arrivalAfterTravel = new Date(cursor.getTime() + stop.travelFromPreviousS * 1_000);
    const estimatedArrivalAt = new Date(Math.max(
      arrivalAfterTravel.getTime(),
      stop.windowStart.getTime(),
    ));
    const estimatedDepartureAt = new Date(
      estimatedArrivalAt.getTime() + stop.serviceDurationMin * 60_000,
    );
    const delayMin = Math.max(0, Math.round(
      (estimatedArrivalAt.getTime() - stop.plannedAt.getTime()) / 60_000,
    ));
    const windowViolationMin = Math.max(0, Math.ceil(
      (estimatedArrivalAt.getTime() - stop.windowEnd.getTime()) / 60_000,
    ));
    result.push({ ...stop, estimatedArrivalAt, estimatedDepartureAt, delayMin, windowViolationMin });
    cursor = estimatedDepartureAt;
  }
  return result;
}

function validateRouteInput(input: RouteOptimizationInput): void {
  const stopIds = input.stops.map(({ id }) => id);
  const uniqueOrder = new Set(input.currentOrder);
  if (
    uniqueOrder.size !== input.currentOrder.length ||
    input.currentOrder.length !== stopIds.length ||
    stopIds.some((id) => !uniqueOrder.has(id))
  ) {
    throw new Error("Chaque passage doit apparaître exactement une fois dans l’ordre courant.");
  }
  if (new Set(stopIds).size !== stopIds.length) throw new Error("Les identifiants de passage doivent être uniques.");
  if (input.lockedStopIds.some((id) => !uniqueOrder.has(id))) throw new Error("Passage verrouillé inconnu.");
}

function getTravel(matrix: TravelMatrix, from: string, to: string): TravelMetric {
  const metric = matrix[from]?.[to];
  if (metric === undefined) throw new Error(`Trajet manquant : ${from} → ${to}.`);
  return metric;
}

function compareMetrics(left: RouteMetrics, right: RouteMetrics): number {
  return left.windowViolationMin - right.windowViolationMin ||
    left.travelDurationS - right.travelDurationS ||
    left.distanceM - right.distanceM;
}

function windowsOverlap(left: CareTimeWindow, right: CareTimeWindow): boolean {
  return left.start < right.end && right.start < left.end;
}

function parseDate(value: string): Date {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function differenceInDays(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

function formatDate(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}
