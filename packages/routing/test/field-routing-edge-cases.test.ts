import { describe, expect, it, vi } from "vitest";

import {
  buildRoutingDiff,
  collectRoutingLocations,
  OsrmHttpClient,
  VroomHttpClient,
  withRoadMetrics,
  type FieldRoutingPlan,
  type FieldRoutingSolution,
} from "../src/index.js";

const cabinet = { longitude: 2.35, latitude: 48.85 };
const patientA = { longitude: 2.36, latitude: 48.86 };
const patientB = { longitude: 2.37, latitude: 48.87 };

function plan(overrides: Partial<FieldRoutingPlan> = {}): FieldRoutingPlan {
  return {
    nurses: [
      {
        id: "emma",
        start: cabinet,
        end: cabinet,
        shift: [21_600, 50_400],
        skills: [7],
        maxVisits: 20,
        breaks: [],
      },
      {
        id: "lea",
        start: cabinet,
        end: cabinet,
        shift: [21_600, 50_400],
        skills: [],
        maxVisits: 20,
        breaks: [],
      },
    ],
    stops: [
      {
        id: "visit-a",
        patientId: "patient-a",
        coordinate: patientA,
        serviceDurationS: 900,
        timeWindows: [],
        priority: 90,
        requiredSkills: [7],
        preferredNurseId: "emma",
        continuityNurseId: null,
        lockedNurseId: null,
        lockedPosition: null,
        kind: "patient",
      },
      {
        id: "visit-b",
        patientId: "patient-b",
        coordinate: patientB,
        serviceDurationS: 600,
        timeWindows: [[28_800, 32_400]],
        priority: 50,
        requiredSkills: [],
        preferredNurseId: null,
        continuityNurseId: null,
        lockedNurseId: null,
        lockedPosition: null,
        kind: "patient",
      },
    ],
    currentAssignments: [
      { nurseId: "emma", stopIds: ["visit-a", "visit-b"] },
      { nurseId: "lea", stopIds: [] },
    ],
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function successfulVroomBody() {
  return {
    code: 0,
    routes: [
      { vehicle: 1, duration: 1_000, distance: 2_000, steps: [{ type: "start", id: 0 }, { type: "job", id: 1 }] },
      { vehicle: 2, duration: 800, distance: 1_500, steps: [{ type: "job", id: 2 }] },
    ],
    unassigned: [],
  };
}

describe("OSRM error boundaries", () => {
  it("does not call OSRM for an empty route", async () => {
    const request = vi.fn<typeof fetch>();
    await expect(new OsrmHttpClient("http://osrm", request).table([])).resolves.toEqual({
      durations: [],
      distances: [],
    });
    expect(request).not.toHaveBeenCalled();
  });

  it("reports HTTP and malformed matrix responses", async () => {
    const unavailable = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 503));
    await expect(new OsrmHttpClient("http://osrm", unavailable).table([cabinet])).rejects.toThrow("503");

    for (const body of [
      { code: "Error", durations: [[0]], distances: [[0]] },
      { code: "Ok", distances: [[0]] },
      { code: "Ok", durations: [[0]] },
    ]) {
      const malformed = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(body));
      await expect(new OsrmHttpClient("http://osrm", malformed).table([cabinet])).rejects.toThrow("invalide");
    }
  });

  it("rounds road metrics and rejects unreachable pairs", async () => {
    const rounded = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      code: "Ok",
      durations: [[0, 10.1], [10.9, 0]],
      distances: [[0, 100.1], [100.9, 0]],
    }));
    await expect(new OsrmHttpClient("http://osrm", rounded).table([cabinet, patientA])).resolves.toMatchObject({
      durations: [[0, 11], [11, 0]],
      distances: [[0, 101], [101, 0]],
    });

    const unreachable = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      code: "Ok",
      durations: [[0, null]],
      distances: [[0, 1]],
    }));
    await expect(new OsrmHttpClient("http://osrm", unreachable).table([cabinet, patientA])).rejects.toThrow("aucune durée");
  });
});

describe("VROOM constraints and failures", () => {
  it("returns assignments, unassigned jobs and calculated workload metrics", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      ...successfulVroomBody(),
      routes: [
        { vehicle: 99, duration: 1_000, distance: 2_000, steps: [{ type: "break", id: 7 }, { type: "job", id: 1 }, { type: "job", id: 99 }] },
        { vehicle: 2, duration: 800, distance: 1_500, steps: [{ type: "job", id: 2 }] },
      ],
      unassigned: [{ id: 1 }, { id: 99 }],
    }));
    const solution = await new VroomHttpClient("http://vroom", request).solve(plan(), {
      durations: [],
      distances: [],
    });
    expect(solution.assignments[0]).toMatchObject({ nurseId: "unknown:99", stopIds: ["visit-a"] });
    expect(solution.unassignedStopIds).toEqual(["visit-a"]);
    expect(solution.metrics).toEqual({
      durationS: 1_800,
      distanceM: 3_500,
      continuityBreaks: 1,
      loadImbalance: 1,
    });
  });

  it("reports HTTP and solver errors", async () => {
    const unavailable = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 502));
    await expect(new VroomHttpClient("http://vroom", unavailable).solve(plan(), { durations: [], distances: [] }))
      .rejects.toThrow("502");

    for (const body of [{ code: 3, error: "No solution" }, { code: 4 }]) {
      const rejected = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(body));
      await expect(new VroomHttpClient("http://vroom", rejected).solve(plan(), { durations: [], distances: [] }))
        .rejects.toThrow(body.error ?? String(body.code));
    }
  });

  it("rejects unknown continuity nurses before sending the request", async () => {
    const request = vi.fn<typeof fetch>();
    const invalid = plan({
      stops: [{ ...plan().stops[0]!, continuityNurseId: "unknown" }],
    });
    await expect(new VroomHttpClient("http://vroom", request).solve(invalid, { durations: [], distances: [] }))
      .rejects.toThrow("IDEL verrouillée inconnue");
    expect(request).not.toHaveBeenCalled();
  });

  it("enforces locked nurse and position after optimization", async () => {
    const nurseLocked = plan({
      stops: [{ ...plan().stops[0]!, lockedNurseId: "emma" }],
      currentAssignments: [{ nurseId: "emma", stopIds: ["visit-a"] }],
    });
    const wrongNurse = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      code: 0,
      routes: [{ vehicle: 2, duration: 1, distance: 1, steps: [{ type: "job", id: 1 }] }],
      unassigned: [],
    }));
    await expect(new VroomHttpClient("http://vroom", wrongNurse).solve(nurseLocked, { durations: [], distances: [] }))
      .rejects.toThrow("autre IDEL");

    const positionLocked = plan({
      stops: [
        { ...plan().stops[0]!, lockedNurseId: "emma", lockedPosition: 0 },
        { ...plan().stops[1]! },
      ],
    });
    const wrongPosition = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      code: 0,
      routes: [{ vehicle: 1, duration: 1, distance: 1, steps: [{ type: "job", id: 2 }, { type: "job", id: 1 }] }],
      unassigned: [],
    }));
    await expect(new VroomHttpClient("http://vroom", wrongPosition).solve(positionLocked, { durations: [], distances: [] }))
      .rejects.toThrow("dans la tournée");
  });

  it("supports an empty workforce without producing invalid metrics", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ code: 0, routes: [], unassigned: [] }));
    const solution = await new VroomHttpClient("http://vroom", request).solve(
      plan({ nurses: [], stops: [], currentAssignments: [] }),
      { durations: [], distances: [] },
    );
    expect(solution.metrics.loadImbalance).toBe(0);
  });
});

describe("route metrics and mandatory diff", () => {
  it("deduplicates locations and recalculates the current route with road data", () => {
    const routePlan = plan({ nurses: [plan().nurses[0]!], stops: [plan().stops[0]!], currentAssignments: [{ nurseId: "emma", stopIds: ["visit-a"] }] });
    expect(collectRoutingLocations(routePlan)).toEqual([cabinet, patientA]);
    expect(withRoadMetrics(routePlan, {
      durations: [[0, 120], [130, 0]],
      distances: [[0, 1_200], [1_300, 0]],
    }).currentAssignments[0]).toMatchObject({ durationS: 250, distanceM: 2_500 });
  });

  it("rejects unknown assignments and incomplete matrices", () => {
    expect(() => withRoadMetrics(plan({ currentAssignments: [{ nurseId: "unknown", stopIds: [] }] }), {
      durations: [], distances: [],
    })).toThrow("IDEL affectée inconnue");

    expect(() => withRoadMetrics(plan({ currentAssignments: [{ nurseId: "emma", stopIds: ["unknown"] }] }), {
      durations: [], distances: [],
    })).toThrow("Passage affecté inconnu");

    const routePlan = plan({ nurses: [plan().nurses[0]!], stops: [plan().stops[0]!], currentAssignments: [{ nurseId: "emma", stopIds: ["visit-a"] }] });
    expect(() => withRoadMetrics(routePlan, { durations: [[0]], distances: [[0]] }))
      .toThrow("Matrice de durée incomplète");
    expect(() => withRoadMetrics(routePlan, {
      durations: [[0, 1], [1, 0]],
      distances: [[0, Number.POSITIVE_INFINITY], [1, 0]],
    })).toThrow("Matrice de distance incomplète");
  });

  it("shows moved, unchanged, newly assigned and unassigned stops before apply", () => {
    const routePlan = plan({
      stops: [
        ...plan().stops,
        { ...plan().stops[0]!, id: "visit-c", patientId: "patient-c", coordinate: { longitude: 2.38, latitude: 48.88 } },
      ],
      currentAssignments: [
        { nurseId: "emma", stopIds: ["visit-a", "visit-b"], durationS: 1_500, distanceM: 3_000 },
        { nurseId: "lea", stopIds: [] },
      ],
    });
    const solution: FieldRoutingSolution = {
      assignments: [
        { nurseId: "emma", stopIds: ["visit-a"], durationS: 900, distanceM: 1_500 },
        { nurseId: "lea", stopIds: ["visit-c"], durationS: 600, distanceM: 900 },
      ],
      unassignedStopIds: ["visit-b"],
      metrics: { durationS: 1_500, distanceM: 2_400, continuityBreaks: 0, loadImbalance: 0 },
    };
    const diff = buildRoutingDiff(routePlan, solution);
    expect(diff.moved).toEqual([{
      stopId: "visit-c",
      fromNurseId: null,
      toNurseId: "lea",
      fromPosition: null,
      toPosition: 0,
    }]);
    expect(diff.before).toEqual({ durationS: 1_500, distanceM: 3_000, continuityBreaks: 0, loadImbalance: 2 });
    expect(diff.gains).toEqual({ durationS: 0, distanceM: 600 });
  });
});
