import { describe, expect, it } from "vitest";

import { CabinetService, type AssignmentChange, type CabinetDashboard, type CabinetRepository } from "../src/services/cabinet-service.js";
import { InMemoryAuditSink } from "../src/services/in-memory-repositories.js";

const organizationId = "0198f54c-4064-7000-8000-000000000701";
const owner = { userId: "0198f54c-4064-7000-8000-000000000702", role: "owner" as const };
const secretary = { userId: "0198f54c-4064-7000-8000-000000000703", role: "secretaire" as const };
const replacement = { userId: "0198f54c-4064-7000-8000-000000000704", role: "remplacant" as const };
const visitId = "0198f54c-4064-7000-8000-000000000705";
const colleagueId = "0198f54c-4064-7000-8000-000000000706";

class FakeCabinetRepository implements CabinetRepository {
  public changes = new Map<string, AssignmentChange>();
  public applied: string[] = [];
  public grants = 0;
  public retrocessions: Array<{ amountCents: number }> = [];

  public async dashboard(_organizationId: string, _actor: { userId: string; role: "owner" | "idel" | "remplacant" | "secretaire" }, from: string, to: string): Promise<CabinetDashboard> {
    return { from, to, members: [], schedule: [], workloads: [], handover: [], notifications: [], activeContracts: 0, retrocessionsToValidate: 0, recentChanges: [] };
  }
  public async upsertAccessGrant(): Promise<void> { this.grants += 1; }
  public async createReplacementContract(): Promise<void> {}
  public async createRetrocession(_organizationId: string, _actorUserId: string, preparation: Parameters<CabinetRepository["createRetrocession"]>[2]): Promise<void> { this.retrocessions.push(preparation); }
  public async getVisitAssignment() { return { assignedUserId: owner.userId, scheduledAt: new Date("2026-08-14T08:00:00.000Z"), status: "planned" }; }
  public async createAssignmentChange(change: AssignmentChange): Promise<void> { this.changes.set(change.id, change); }
  public async getAssignmentChange(_organizationId: string, changeId: string): Promise<AssignmentChange | null> { return this.changes.get(changeId) ?? null; }
  public async applyAssignmentChange(_organizationId: string, changeId: string): Promise<void> {
    const change = this.changes.get(changeId);
    if (change !== undefined) this.changes.set(changeId, { ...change, status: "applied" });
    this.applied.push(changeId);
  }
}

function setup() {
  const repository = new FakeCabinetRepository();
  const audit = new InMemoryAuditSink();
  return { repository, audit, service: new CabinetService(repository, audit, () => new Date("2026-08-13T10:00:00.000Z")) };
}

describe("CabinetService", () => {
  it("allows only the owner to grant patient access for a bounded period", async () => {
    const { repository, service } = setup();
    const grant = {
      grantId: "0198f54c-4064-7000-8000-000000000710",
      userId: replacement.userId,
      patientId: "0198f54c-4064-7000-8000-000000000711",
      startsAt: "2026-08-14T06:00:00.000Z",
      endsAt: "2026-08-20T18:00:00.000Z",
      permissions: ["read", "care", "transmission"] as const,
    };
    await service.grantPatientAccess(organizationId, owner, { ...grant, permissions: [...grant.permissions] });
    expect(repository.grants).toBe(1);
    await expect(service.grantPatientAccess(organizationId, secretary, { ...grant, permissions: [...grant.permissions] }))
      .rejects.toThrow("réservée à la titulaire");
  });

  it("requires a visible diff before applying a reassignment", async () => {
    const { repository, audit, service } = setup();
    const changeId = "0198f54c-4064-7000-8000-000000000720";
    const preview = await service.previewReassignment(organizationId, secretary, {
      changeId, visitId, toUserId: colleagueId, reason: "Équilibrage de la tournée synthétique",
    });
    expect(preview.requiresConfirmation).toBe(true);
    expect(preview.diff).toMatchObject({ fromUserId: owner.userId, toUserId: colleagueId });
    expect(repository.applied).toEqual([]);
    await service.applyReassignment(organizationId, secretary, changeId);
    expect(repository.applied).toEqual([changeId]);
    expect(audit.records.at(-1)?.action).toBe("visit.reassigned");
  });

  it("prevents a replacement from changing the shared schedule", async () => {
    const { service } = setup();
    await expect(service.previewReassignment(organizationId, replacement, {
      changeId: "0198f54c-4064-7000-8000-000000000730",
      visitId,
      toUserId: colleagueId,
      reason: "Réaffectation non autorisée",
    })).rejects.toThrow("réaffectation est réservée au cabinet");
  });

  it("calculates a retrocession draft without marking it as validated", async () => {
    const { repository, service } = setup();
    const result = await service.prepareRetrocession(organizationId, owner, {
      periodId: "0198f54c-4064-7000-8000-000000000740",
      incumbentUserId: owner.userId,
      replacementUserId: replacement.userId,
      periodStart: "2026-08-01",
      periodEnd: "2026-08-15",
      grossAmountCents: 123_456,
      rate: 10,
    });
    expect(result).toMatchObject({ amountCents: 12_346, status: "draft", requiresValidation: true });
    expect(repository.retrocessions[0]).toMatchObject({ amountCents: 12_346 });
  });
});
