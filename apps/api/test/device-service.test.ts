import { describe, expect, it } from "vitest";

import { DeviceService } from "../src/services/device-service.js";
import { InMemoryAuditSink, InMemoryDeviceRepository } from "../src/services/in-memory-repositories.js";

const organizationId = "0198f54c-4064-7000-8000-000000000701";
const userId = "0198f54c-4064-7000-8000-000000000702";
const deviceId = "0198f54c-4064-7000-8000-000000000703";

describe("DeviceService", () => {
  it("permet au titulaire de déclencher puis confirmer une purge distante", async () => {
    const repository = new InMemoryDeviceRepository();
    const revokedUsers: string[] = [];
    const service = new DeviceService(
      repository,
      new InMemoryAuditSink(),
      () => new Date("2026-08-13T08:00:00Z"),
      (revokedUserId) => { revokedUsers.push(revokedUserId); return Promise.resolve(); },
    );
    await service.register({
      organizationId,
      actor: { userId, role: "owner" },
      device: { id: deviceId, label: "iPhone Emma", platform: "ios", biometricEnabled: true },
    });
    await expect(service.requestWipe(organizationId, { userId, role: "owner" }, deviceId)).resolves.toMatchObject({ wipeRequested: true });
    await service.register({
      organizationId,
      actor: { userId, role: "owner" },
      device: { id: deviceId, label: "iPhone Emma reconnecté", platform: "ios", biometricEnabled: true },
    });
    expect(revokedUsers).toEqual([]);
    await expect(service.status(organizationId, { userId, role: "owner" }, deviceId)).resolves.toMatchObject({ wipeRequested: true });
    await expect(service.acknowledgeWipe(organizationId, { userId, role: "owner" }, deviceId)).resolves.toEqual({ deviceId, wiped: true });
    expect(revokedUsers).toEqual([userId]);
  });

  it("interdit la demande de purge à une remplaçante", async () => {
    const service = new DeviceService(new InMemoryDeviceRepository(), new InMemoryAuditSink());
    await expect(service.requestWipe(organizationId, { userId, role: "remplacant" }, deviceId)).rejects.toThrow("titulaire");
  });
});
