import { describe, expect, it, vi } from "vitest";

import {
  OsrmHttpClient,
  VroomHttpClient,
  type FieldRoutingPlan,
} from "../src/index.js";

const plan: FieldRoutingPlan = {
  nurses: [{
    id: "emma",
    start: { longitude: 2.35, latitude: 48.85 },
    end: { longitude: 2.35, latitude: 48.85 },
    shift: [21_600, 50_400],
    skills: [7],
    maxVisits: 20,
    breaks: [{ id: "pause", durationS: 1_200, timeWindows: [[41_400, 48_600]] }],
  }],
  stops: [{
    id: "visit-a",
    patientId: "patient-a",
    coordinate: { longitude: 2.36, latitude: 48.86 },
    serviceDurationS: 900,
    timeWindows: [[25_200, 28_800]],
    priority: 90,
    requiredSkills: [7],
    preferredNurseId: "emma",
    continuityNurseId: "emma",
    lockedNurseId: "emma",
    lockedPosition: null,
    kind: "patient",
  }],
  currentAssignments: [{ nurseId: "emma", stopIds: ["visit-a"], durationS: 800, distanceM: 2_000 }],
};

describe("self-hosted routing clients", () => {
  it("requests both duration and distance matrices from OSRM", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      code: "Ok",
      durations: [[0, 120], [130, 0]],
      distances: [[0, 1_200], [1_250, 0]],
    }), { status: 200 }));
    const matrix = await new OsrmHttpClient("http://osrm.internal/", request).table([
      { longitude: 2.35, latitude: 48.85 },
      { longitude: 2.36, latitude: 48.86 },
    ]);
    expect(request).toHaveBeenCalledWith(expect.stringContaining("annotations=duration,distance"));
    expect(matrix.distances[0]?.[1]).toBe(1_200);
  });

  it("sends VROOM custom matrices, constraints and nurse affinity", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      code: 0,
      routes: [{ vehicle: 1, duration: 500, distance: 1_200, steps: [{ type: "job", id: 1 }] }],
      unassigned: [],
    }), { status: 200 }));
    const solution = await new VroomHttpClient("http://vroom.internal", request).solve(plan, {
      durations: [[0, 120], [130, 0]],
      distances: [[0, 1_200], [1_250, 0]],
    });
    const rawBody = request.mock.calls[0]?.[1]?.body;
    if (typeof rawBody !== "string") throw new Error("Expected a JSON request body.");
    const body = JSON.parse(rawBody) as {
      matrices: unknown;
      jobs: Array<{ skills: number[]; time_windows: Array<[number, number]> }>;
      vehicles: Array<{ breaks: unknown[]; skills: number[] }>;
    };
    expect(body.matrices).toBeDefined();
    expect(body.jobs[0]?.skills).toContain(7);
    expect(body.jobs[0]?.skills.some((skill) => skill >= 1_000_000)).toBe(true);
    expect(body.vehicles[0]?.breaks).toHaveLength(1);
    expect(solution.assignments[0]?.stopIds).toEqual(["visit-a"]);
  });
});
