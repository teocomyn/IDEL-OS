import { randomBytes } from "node:crypto";

import { EncryptionService, LocalKeyProvider } from "@idel-os/db";
import { describe, expect, it } from "vitest";

import {
  InMemoryAuditSink,
  InMemoryTransmissionRepository,
} from "../src/services/in-memory-repositories.js";
import { TransmissionService } from "../src/services/transmission-service.js";

const organizationA = "0198f54c-4064-7000-8000-000000000301";
const organizationB = "0198f54c-4064-7000-8000-000000000302";
const actor = {
  userId: "0198f54c-4064-7000-8000-000000000303",
  role: "remplacant" as const,
};
const input = {
  transmissionId: "0198f54c-4064-7000-8000-000000000304",
  patientId: "0198f54c-4064-7000-8000-000000000305",
  visitId: "0198f54c-4064-7000-8000-000000000306",
  rawTranscript: "Transmission vocale entièrement synthétique.",
  structured: {
    actsPerformed: [{ label: "Pansement fictif", conformToProtocol: true }],
    observations: [{ text: "Observation synthétique", source: "observed" as const }],
    vitals: [{ type: "eva" as const, value: 2, value2: null, unit: "/10" }],
    concerns: [{ text: "À contrôler", urgency: "a_surveiller" as const }],
    nextVisitNotes: "Prévoir une compresse fictive.",
    missingInfo: [],
  },
};

function setup() {
  const repository = new InMemoryTransmissionRepository();
  const audit = new InMemoryAuditSink();
  const service = new TransmissionService(
    repository,
    audit,
    new EncryptionService(new LocalKeyProvider(randomBytes(32))),
  );
  return { repository, audit, service };
}

describe("TransmissionService", () => {
  it("encrypts all narrative health content before persistence", async () => {
    const { repository, audit, service } = setup();
    await service.createDraft({ organizationId: organizationA, actor, input });

    const stored = await repository.findById(organizationA, input.transmissionId);
    expect(stored?.rawTranscriptEnc).not.toContain(input.rawTranscript);
    expect(stored?.structuredJsonEnc).not.toContain("Observation synthétique");
    expect(stored?.finalTextEnc).not.toContain("Pansement fictif");
    expect(JSON.stringify(audit.records)).not.toContain(input.rawTranscript);
  });

  it("isolates transmissions by organization", async () => {
    const { service } = setup();
    await service.createDraft({ organizationId: organizationA, actor, input });
    await expect(service.listByPatient(organizationB, input.patientId)).resolves.toEqual([]);
  });

  it("requires an explicit human validation and prevents double validation", async () => {
    const { audit, service } = setup();
    await service.createDraft({ organizationId: organizationA, actor, input });
    const validated = await service.validate({
      organizationId: organizationA,
      actor,
      transmissionId: input.transmissionId,
    });
    expect(validated.status).toBe("validated");
    expect(validated.validatedAt).toBeInstanceOf(Date);
    expect(audit.records.map(({ action }) => action)).toEqual([
      "transmission.draft_created",
      "transmission.validated",
    ]);
    await expect(service.validate({
      organizationId: organizationA,
      actor,
      transmissionId: input.transmissionId,
    })).rejects.toThrow("déjà validée");
  });
});
