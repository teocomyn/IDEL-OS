import { describe, expect, it } from "vitest";

import {
  InMemoryAuditSink,
  InMemoryVisitLifecycleRepository,
} from "../src/services/in-memory-repositories.js";
import { VisitService, type StoredVisitLifecycle } from "../src/services/visit-service.js";

const organizationId = "0198f54c-4064-7000-8000-000000000501";
const visitId = "0198f54c-4064-7000-8000-000000000502";
const actor = { userId: "0198f54c-4064-7000-8000-000000000503", role: "remplacant" as const };
const firstActId = "0198f54c-4064-7000-8000-000000000504";
const secondActId = "0198f54c-4064-7000-8000-000000000505";

function plannedVisit(overrides: Partial<StoredVisitLifecycle> = {}): StoredVisitLifecycle {
  return {
    id: visitId,
    organizationId,
    patientId: "0198f54c-4064-7000-8000-000000000506",
    assignedUserId: actor.userId,
    status: "planned",
    startedAt: null,
    endedAt: null,
    acts: [
      { id: firstActId, performed: false },
      { id: secondActId, performed: false },
    ],
    ...overrides,
  };
}

function setup(visit = plannedVisit()) {
  const repository = new InMemoryVisitLifecycleRepository();
  repository.visits.set(`${organizationId}:${visitId}`, visit);
  const audit = new InMemoryAuditSink();
  const times = [new Date("2026-08-12T06:44:00Z"), new Date("2026-08-12T07:05:00Z")];
  const service = new VisitService(repository, audit, () => times.shift() ?? new Date("2026-08-12T07:05:00Z"));
  return { repository, audit, service };
}

describe("VisitService", () => {
  it("démarre un passage planifié et trace l’action", async () => {
    const { audit, service } = setup();
    const started = await service.start({ organizationId, actor, visitId });
    expect(started).toMatchObject({ status: "in_progress", startedAt: new Date("2026-08-12T06:44:00Z") });
    expect(audit.records.map(({ action }) => action)).toEqual(["visit.started"]);
  });

  it("interdit de démarrer le passage d’un autre professionnel", async () => {
    const { service } = setup(plannedVisit({ assignedUserId: "0198f54c-4064-7000-8000-000000000599" }));
    await expect(service.start({ organizationId, actor, visitId })).rejects.toThrow("autre professionnel");
  });

  it("interdit au secrétariat de réaliser un passage", async () => {
    const { service } = setup();
    await expect(service.start({
      organizationId,
      actor: { ...actor, role: "secretaire" },
      visitId,
    })).rejects.toThrow("professionnel infirmier");
  });

  it("exige un passage en cours avant la checklist", async () => {
    const { service } = setup();
    await expect(service.setActPerformed({
      organizationId,
      actor,
      visitId,
      visitActId: firstActId,
      performed: true,
    })).rejects.toThrow("Démarrez le passage");
  });

  it("refuse un acte qui n’appartient pas au passage", async () => {
    const { service } = setup(plannedVisit({ status: "in_progress" }));
    await expect(service.setActPerformed({
      organizationId,
      actor,
      visitId,
      visitActId: "0198f54c-4064-7000-8000-000000000598",
      performed: true,
    })).rejects.toThrow("Acte du passage introuvable");
  });

  it("bloque la fin tant que tous les actes ne sont pas confirmés", async () => {
    const { service } = setup(plannedVisit({ status: "in_progress" }));
    await expect(service.complete({ organizationId, actor, visitId })).rejects.toThrow("Confirmez chaque acte");
  });

  it("termine le passage après la checklist complète et l’audite", async () => {
    const { audit, service } = setup();
    await service.start({ organizationId, actor, visitId });
    await service.setActPerformed({ organizationId, actor, visitId, visitActId: firstActId, performed: true });
    await service.setActPerformed({ organizationId, actor, visitId, visitActId: secondActId, performed: true });
    const completed = await service.complete({ organizationId, actor, visitId });
    expect(completed).toMatchObject({ status: "done", endedAt: new Date("2026-08-12T07:05:00Z") });
    expect(audit.records.map(({ action }) => action)).toEqual(["visit.started", "visit.completed"]);
    expect(JSON.stringify(audit.records)).not.toContain(firstActId);
  });

  it("rend la fin idempotente pour un rejeu après coupure réseau", async () => {
    const { service } = setup(plannedVisit({ status: "done", acts: [
      { id: firstActId, performed: true },
      { id: secondActId, performed: true },
    ] }));
    await expect(service.complete({ organizationId, actor, visitId })).resolves.toMatchObject({ status: "done" });
  });
});
