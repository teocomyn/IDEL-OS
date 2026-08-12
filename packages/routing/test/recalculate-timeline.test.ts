import { describe, expect, it } from "vitest";

import { recalculateTimeline, type TimelineStop } from "../src/index.js";

function stop(id: string, planned: string, status: TimelineStop["status"] = "planned"): TimelineStop {
  return {
    id,
    plannedAt: new Date(`2026-08-13T${planned}:00.000Z`),
    windowStart: new Date(`2026-08-13T${planned}:00.000Z`),
    windowEnd: new Date(`2026-08-13T${planned.slice(0, 2)}:59:00.000Z`),
    serviceDurationMin: 20,
    travelFromPreviousS: 10 * 60,
    status,
  };
}

describe("recalculateTimeline", () => {
  it("propage réellement le retard aux prochains patients", () => {
    const result = recalculateTimeline({
      anchorAt: new Date("2026-08-13T08:25:00.000Z"),
      stops: [stop("a", "08:10"), stop("b", "08:40")],
    });
    expect(result.map(({ estimatedArrivalAt }) => estimatedArrivalAt.toISOString())).toEqual([
      "2026-08-13T08:35:00.000Z",
      "2026-08-13T09:05:00.000Z",
    ]);
    expect(result.map(({ delayMin }) => delayMin)).toEqual([25, 25]);
  });

  it("retire les passages déjà terminés ou annulés du recalcul", () => {
    const result = recalculateTimeline({
      anchorAt: new Date("2026-08-13T08:00:00.000Z"),
      stops: [stop("done", "08:00", "done"), stop("cancelled", "08:20", "cancelled"), stop("next", "08:40")],
    });
    expect(result.map(({ id }) => id)).toEqual(["next"]);
  });
});
