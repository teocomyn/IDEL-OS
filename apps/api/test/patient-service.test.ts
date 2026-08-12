import { randomBytes } from "node:crypto";

import { EncryptionService, LocalKeyProvider } from "@idel-os/db";
import { describe, expect, it } from "vitest";

import { InMemoryAuditSink, InMemoryPatientRepository } from "../src/services/in-memory-repositories.js";
import { PatientService } from "../src/services/patient-service.js";

const organizationA = "0198f54c-4064-7000-8000-000000000201";
const organizationB = "0198f54c-4064-7000-8000-000000000202";
const actor = {
  userId: "0198f54c-4064-7000-8000-000000000203",
  role: "idel" as const,
};
const input = {
  firstName: "Patient-Synthétique-Alpha",
  lastName: "Fictif-Zéro",
  birthDate: "1970-01-01",
  phone: null,
  email: null,
  notes: "Fixture strictement synthétique",
  addressLine: "1 rue Imaginaire",
  postalCode: "00000",
  city: "Ville Fictive",
  accessNotes: null,
  mobility: "autonomous" as const,
  isAld: false,
  aldDetails: null,
  isDiabetic: false,
};

describe("PatientService", () => {
  it("encrypts identifying fields before persistence and decrypts them for the owner", async () => {
    const repository = new InMemoryPatientRepository();
    const audit = new InMemoryAuditSink();
    const service = new PatientService(
      repository,
      audit,
      new EncryptionService(new LocalKeyProvider(randomBytes(32))),
    );
    const id = "0198f54c-4064-7000-8000-000000000204";
    await service.create({ organizationId: organizationA, actor, patientId: id, input });

    const stored = await repository.findById(organizationA, id);
    expect(stored?.firstNameEnc).not.toContain(input.firstName);
    await expect(service.get(organizationA, id)).resolves.toMatchObject({ firstName: input.firstName });
    expect(audit.records).toHaveLength(1);
    expect(JSON.stringify(audit.records)).not.toContain(input.firstName);
  });

  it("does not return a patient from another organization", async () => {
    const repository = new InMemoryPatientRepository();
    const service = new PatientService(
      repository,
      new InMemoryAuditSink(),
      new EncryptionService(new LocalKeyProvider(randomBytes(32))),
    );
    const id = "0198f54c-4064-7000-8000-000000000205";
    await service.create({ organizationId: organizationA, actor, patientId: id, input });
    await expect(service.get(organizationB, id)).rejects.toThrow("introuvable");
  });

  it("creates an audited new encrypted state on update", async () => {
    const audit = new InMemoryAuditSink();
    const service = new PatientService(
      new InMemoryPatientRepository(),
      audit,
      new EncryptionService(new LocalKeyProvider(randomBytes(32))),
    );
    const id = "0198f54c-4064-7000-8000-000000000206";
    await service.create({ organizationId: organizationA, actor, patientId: id, input });
    await service.update({
      organizationId: organizationA,
      actor,
      patientId: id,
      patch: { accessNotes: "Code synthétique modifié" },
    });
    await expect(service.get(organizationA, id)).resolves.toMatchObject({
      accessNotes: "Code synthétique modifié",
    });
    expect(audit.records.map((record) => record.action)).toEqual([
      "patient.created",
      "patient.updated",
    ]);
  });
});
