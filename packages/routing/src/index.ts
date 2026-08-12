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
