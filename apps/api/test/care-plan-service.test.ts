import { describe, expect, it } from "vitest";

import {
  InMemoryAuditSink,
  InMemoryCarePlanRepository,
} from "../src/services/in-memory-repositories.js";
import { CarePlanService } from "../src/services/care-plan-service.js";

const organizationId = "0198f54c-4064-7000-8000-000000000401";
const patientId = "0198f54c-4064-7000-8000-000000000402";
const prescriptionId = "0198f54c-4064-7000-8000-000000000403";
const carePlanId = "0198f54c-4064-7000-8000-000000000404";
const actor = { userId: "0198f54c-4064-7000-8000-000000000405", role: "idel" as const };
const input = {
  carePlanId,
  patientId,
  prescriptionId,
  name: "Plan de soins fictif",
  startDate: "2026-08-13",
  endDate: "2026-08-15",
  items: [{
    id: "0198f54c-4064-7000-8000-000000000406",
    prescriptionItemId: "0198f54c-4064-7000-8000-000000000407",
    actCatalogId: "0198f54c-4064-7000-8000-000000000408",
    label: "Soin fictif",
    estimatedDurationMin: 20,
    requiresTwoNurses: false,
    frequency: {
      kind: "daily" as const,
      timesPerDay: 2,
      everyNDays: 1,
      timeWindows: [
        { start: "07:00", end: "09:00" },
        { start: "18:00", end: "20:00" },
      ],
    },
  }],
};

function setup() {
  const repository = new InMemoryCarePlanRepository();
  const audit = new InMemoryAuditSink();
  const service = new CarePlanService(repository, audit);
  return { repository, audit, service };
}

describe("CarePlanService", () => {
  it("refuse de créer des passages avant validation humaine de l’ordonnance", async () => {
    const { service } = setup();
    await expect(service.activate({ organizationId, actor, input })).rejects.toThrow(
      "L’ordonnance doit être relue et validée",
    );
  });

  it("crée le plan et tous les passages en une activation", async () => {
    const { repository, audit, service } = setup();
    repository.validatedPrescriptions.add(`${organizationId}:${prescriptionId}:${patientId}`);
    const result = await service.activate({ organizationId, actor, input });

    expect(result).toMatchObject({ status: "active", itemCount: 1, visitCount: 6 });
    expect(repository.plans[0]?.visits).toHaveLength(6);
    expect(repository.plans[0]?.visits[0]).toMatchObject({
      timeWindowStart: "07:00",
      timeWindowEnd: "09:00",
      carePlanItemIds: [input.items[0]?.id],
    });
    expect(audit.records).toHaveLength(1);
    expect(audit.records[0]?.action).toBe("care_plan.activated");
  });

  it("ne met aucune donnée narrative de santé dans l’audit", async () => {
    const { repository, audit, service } = setup();
    repository.validatedPrescriptions.add(`${organizationId}:${prescriptionId}:${patientId}`);
    await service.activate({ organizationId, actor, input });
    expect(JSON.stringify(audit.records)).not.toContain(input.items[0]?.label);
    expect(JSON.stringify(audit.records)).not.toContain(input.name);
  });

  it("interdit la validation clinique au rôle secrétaire", async () => {
    const { repository, service } = setup();
    repository.validatedPrescriptions.add(`${organizationId}:${prescriptionId}:${patientId}`);
    await expect(service.activate({
      organizationId,
      actor: { ...actor, role: "secretaire" },
      input,
    })).rejects.toThrow("professionnel infirmier");
  });
});
