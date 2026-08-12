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
