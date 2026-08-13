import { describe, expect, it } from "vitest";

import type { FieldRoutingPlan, FieldRoutingSolution } from "@idel-os/routing";

import {
  OptimizationService,
  type OptimizationRepository,
  type StoredOptimizationProposal,
} from "../src/services/optimization-service.js";

const plan: FieldRoutingPlan = {
  nurses: [{ id: "nurse-a", start: { longitude: 2.3, latitude: 48.8 }, end: { longitude: 2.3, latitude: 48.8 }, shift: [0, 86_399], skills: [], maxVisits: 20, breaks: [] }],
  stops: [{ id: "visit-a", patientId: "patient-a", coordinate: { longitude: 2.31, latitude: 48.81 }, serviceDurationS: 600, timeWindows: [], priority: 50, requiredSkills: [], preferredNurseId: "nurse-a", continuityNurseId: "nurse-a", lockedNurseId: null, lockedPosition: null, kind: "patient" }],
  currentAssignments: [{ nurseId: "nurse-a", stopIds: ["visit-a"], durationS: 900, distanceM: 3_000 }],
};

class Repository implements OptimizationRepository {
  public proposal: StoredOptimizationProposal | null = null;
  public applied = false;
  public async loadPlan() { return { anchorTourId: "tour-a", plan }; }
  public async saveProposal(proposal: StoredOptimizationProposal) { this.proposal = structuredClone(proposal); }
  public async findProposal() { return this.proposal === null ? null : structuredClone(this.proposal); }
  public async applyProposal() { this.applied = true; if (this.proposal !== null) this.proposal.accepted = true; }
}

const solution: FieldRoutingSolution = {
  assignments: [{ nurseId: "nurse-a", stopIds: ["visit-a"], durationS: 500, distanceM: 1_200 }],
  unassignedStopIds: [],
  metrics: { durationS: 500, distanceM: 1_200, continuityBreaks: 0, loadImbalance: 0 },
};
const currentMatrix = {
  durations: [[0, 450], [450, 0]],
  distances: [[0, 1_500], [1_500, 0]],
};

describe("OptimizationService", () => {
  it("persists a proposal without applying it, then requires explicit application", async () => {
    const repository = new Repository();
    const service = new OptimizationService(
      repository,
      { table: () => Promise.resolve(currentMatrix) },
      { solve: () => Promise.resolve(solution) },
      () => "0198f54c-4064-7000-8000-000000000901",
    );
    const proposed = await service.propose("org-a", { userId: "owner-a", role: "owner" }, {
      date: "2026-08-13",
      lockedVisitIds: [],
    });
    expect(repository.applied).toBe(false);
    expect(proposed.diff.gains.distanceM).toBe(1_800);
    await service.apply("org-a", { userId: "owner-a", role: "owner" }, proposed.optimizationRunId);
    expect(repository.applied).toBe(true);
  });

  it("refuses a proposal that leaves a patient unassigned", async () => {
    const repository = new Repository();
    const service = new OptimizationService(
      repository,
      { table: () => Promise.resolve(currentMatrix) },
      { solve: () => Promise.resolve({ ...solution, unassignedStopIds: ["visit-a"] }) },
      () => "0198f54c-4064-7000-8000-000000000902",
    );
    await expect(service.propose("org-a", { userId: "owner-a", role: "owner" }, {
      date: "2026-08-13",
      lockedVisitIds: [],
    })).rejects.toThrow("1 passage");
    expect(repository.proposal).toBeNull();
  });
});
