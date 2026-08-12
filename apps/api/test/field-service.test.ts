import { describe, expect, it } from "vitest";

import { EncryptionService, LocalKeyProvider } from "@idel-os/db";

import { FieldService, type StoredTodayVisit } from "../src/services/field-service.js";
import { InMemoryAuditSink, InMemoryFieldRepository } from "../src/services/in-memory-repositories.js";

const organizationId = "0198f54c-4064-7000-8000-000000000601";
const userId = "0198f54c-4064-7000-8000-000000000602";
const visitId = "0198f54c-4064-7000-8000-000000000603";
const encryption = new EncryptionService(new LocalKeyProvider(Buffer.alloc(32, 9)));

async function setup() {
  const repository = new InMemoryFieldRepository();
  const audit = new InMemoryAuditSink();
  const visit: StoredTodayVisit = {
    id: visitId,
    patientId: "0198f54c-4064-7000-8000-000000000604",
    assignedUserId: userId,
    scheduledAt: new Date("2026-08-13T06:30:00.000Z"),
    timeWindowStart: "08:00:00",
    timeWindowEnd: "09:00:00",
    estimatedDurationMin: 20,
    status: "planned",
    positionInTour: 1,
    firstNameEnc: await encryption.encrypt(organizationId, "Emma"),
    lastNameEnc: await encryption.encrypt(organizationId, "Exemple"),
    addressLineEnc: await encryption.encrypt(organizationId, "8 rue Fictive"),
    postalCode: "75001",
    city: "Paris",
    geo: { x: 2.35, y: 48.86 },
    acts: [{ id: "0198f54c-4064-7000-8000-000000000605", label: "Pansement", performed: false }],
  };
  repository.visits.set(visitId, visit);
  const service = new FieldService(repository, audit, encryption, () => new Date("2026-08-13T06:45:00.000Z"));
  return { repository, audit, service };
}

describe("FieldService", () => {
  it("retourne les vrais passages déchiffrés avec l'heure recalculée", async () => {
    const { service } = await setup();
    const [visit] = await service.today(organizationId, { userId, role: "remplacant" }, "2026-08-13");
    expect(visit).toMatchObject({
      patientDisplayName: "Emma Exemple",
      address: "8 rue Fictive, 75001 Paris",
      delayMin: 15,
      coordinates: { latitude: 48.86, longitude: 2.35 },
    });
  });

  it("enregistre une absence une seule fois et sans note clinique dans l'audit", async () => {
    const { service, repository, audit } = await setup();
    const input = {
      visitId,
      idempotencyKey: "device:absence:1",
      type: "absence" as const,
      note: "Patient injoignable, volet fermé",
    };
    await expect(service.recordException({ organizationId, actor: { userId, role: "idel" }, input })).resolves.toEqual({ visitId, applied: true });
    await expect(service.recordException({ organizationId, actor: { userId, role: "idel" }, input })).resolves.toEqual({ visitId, applied: false });
    expect(repository.exceptions).toHaveLength(1);
    expect(repository.visits.get(visitId)?.status).toBe("missed");
    expect(JSON.stringify(audit.records)).not.toContain("volet fermé");
  });
});
