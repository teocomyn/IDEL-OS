import { describe, expect, it } from "vitest";

import {
  evaluateRoute,
  proposeRouteOptimization,
  type RouteOptimizationInput,
  type TravelMatrix,
} from "../src/index.js";

const matrix: TravelMatrix = {
  cabinet: {
    a: { distanceM: 4_000, durationS: 600 },
    b: { distanceM: 1_000, durationS: 180 },
    c: { distanceM: 2_000, durationS: 300 },
  },
  a: {
    b: { distanceM: 4_000, durationS: 600 },
    c: { distanceM: 1_000, durationS: 180 },
    cabinet: { distanceM: 4_000, durationS: 600 },
  },
  b: {
    a: { distanceM: 1_000, durationS: 180 },
    c: { distanceM: 4_000, durationS: 600 },
    cabinet: { distanceM: 1_000, durationS: 180 },
  },
  c: {
    a: { distanceM: 1_000, durationS: 180 },
    b: { distanceM: 1_000, durationS: 180 },
    cabinet: { distanceM: 2_000, durationS: 300 },
  },
};

function input(overrides: Partial<RouteOptimizationInput> = {}): RouteOptimizationInput {
  return {
    currentOrder: ["a", "b", "c"],
    stops: [
      { id: "a", serviceDurationMin: 10, windowStartMin: 7 * 60, windowEndMin: 10 * 60 },
      { id: "b", serviceDurationMin: 10, windowStartMin: 7 * 60, windowEndMin: 10 * 60 },
      { id: "c", serviceDurationMin: 10, windowStartMin: 7 * 60, windowEndMin: 10 * 60 },
    ],
    matrix,
    startId: "cabinet",
    endId: "cabinet",
    departureMinute: 7 * 60,
    lockedStopIds: [],
    ...overrides,
  };
}

describe("proposeRouteOptimization", () => {
  it("réduit le trajet sans créer de violation horaire", () => {
    const proposal = proposeRouteOptimization(input());
    expect(proposal.proposedOrder).toEqual(["b", "a", "c"]);
    expect(proposal.after.travelDurationS).toBeLessThan(proposal.before.travelDurationS);
    expect(proposal.after.windowViolationMin).toBe(0);
    expect(proposal.movedStopIds).toEqual(["a", "b"]);
  });

  it("conserve exactement la position d’un passage verrouillé", () => {
    const proposal = proposeRouteOptimization(input({ lockedStopIds: ["a"] }));
    expect(proposal.proposedOrder[0]).toBe("a");
    expect(proposal.lockedStopIds).toEqual(["a"]);
  });

  it("ne propose aucun changement lorsque l’ordre est déjà optimal", () => {
    const proposal = proposeRouteOptimization(input({ currentOrder: ["b", "a", "c"] }));
    expect(proposal.proposedOrder).toEqual(["b", "a", "c"]);
    expect(proposal.movedStopIds).toEqual([]);
  });

  it("privilégie une fenêtre impérative même si le trajet est plus long", () => {
    const urgent = input({
      stops: [
        { id: "a", serviceDurationMin: 10, windowStartMin: 7 * 60, windowEndMin: 10 * 60 },
        { id: "b", serviceDurationMin: 10, windowStartMin: 7 * 60, windowEndMin: 10 * 60 },
        { id: "c", serviceDurationMin: 10, windowStartMin: 7 * 60, windowEndMin: 7 * 60 + 6 },
      ],
    });
    const proposal = proposeRouteOptimization(urgent);
    expect(proposal.proposedOrder[0]).toBe("c");
    expect(proposal.after.windowViolationMin).toBe(0);
  });

  it("refuse un ordre contenant deux fois le même passage", () => {
    expect(() => proposeRouteOptimization(input({ currentOrder: ["a", "a", "c"] }))).toThrow(
      "exactement une fois",
    );
  });

  it("refuse une métrique de trajet manquante", () => {
    const broken = structuredClone(matrix);
    delete broken.a?.b;
    expect(() => proposeRouteOptimization(input({ matrix: broken }))).toThrow("Trajet manquant");
  });
});

describe("evaluateRoute", () => {
  it("retourne des métriques nulles lorsque tous les passages sont terminés", () => {
    const route = evaluateRoute({
      ...input({ currentOrder: [], stops: [] }),
      order: [],
    });
    expect(route).toEqual({
      distanceM: 0,
      travelDurationS: 0,
      waitingDurationS: 0,
      serviceDurationS: 0,
      totalDurationS: 0,
      windowViolationMin: 0,
    });
  });

  it("inclut l’attente et le retour au point d’arrivée", () => {
    const route = evaluateRoute({
      ...input({
        currentOrder: ["b"],
        stops: [{ id: "b", serviceDurationMin: 10, windowStartMin: 8 * 60, windowEndMin: 9 * 60 }],
      }),
      order: ["b"],
    });
    expect(route.waitingDurationS).toBe(57 * 60);
    expect(route.travelDurationS).toBe(360);
    expect(route.totalDurationS).toBe(73 * 60);
  });
});
