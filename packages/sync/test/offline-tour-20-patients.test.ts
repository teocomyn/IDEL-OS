import { describe, expect, it } from "vitest";

import { ActionQueue, InMemoryQueueStorage } from "../src/action-queue.js";
import { InMemoryOfflineTourStorage, OfflineTourController, type OfflineVisit } from "../src/offline-tour.js";
import { SyncEngine } from "../src/sync-engine.js";

function createVisit(index: number): OfflineVisit {
  const suffix = String(index).padStart(3, "0");
  return {
    id: `0198f54c-4064-7000-8000-000000001${suffix}`,
    patientId: `0198f54c-4064-7000-8000-000000002${suffix}`,
    patientDisplayName: `Patient fictif ${index}`,
    address: `${index} rue de la Démonstration`,
    scheduledAt: `2026-08-13T${String(6 + Math.floor(index / 4)).padStart(2, "0")}:${String((index % 4) * 15).padStart(2, "0")}:00.000Z`,
    estimatedArrivalAt: `2026-08-13T${String(6 + Math.floor(index / 4)).padStart(2, "0")}:${String((index % 4) * 15).padStart(2, "0")}:00.000Z`,
    estimatedDurationMin: 15,
    travelFromPreviousMin: 5,
    status: "planned",
    localVersion: 0,
    acts: [
      { id: `0198f54c-4064-7000-8001-000000001${suffix}`, label: "Acte fictif A", performed: false },
      { id: `0198f54c-4064-7000-8002-000000001${suffix}`, label: "Acte fictif B", performed: false },
    ],
    exception: null,
  };
}

describe("tournée obligatoire de 20 patients hors ligne", () => {
  it("conserve chaque checklist puis synchronise sans perte ni doublon", async () => {
    const queue = new ActionQueue(new InMemoryQueueStorage());
    const storage = new InMemoryOfflineTourStorage();
    let idIndex = 10_000;
    const controller = new OfflineTourController(
      storage,
      queue,
      () => `0198f54c-4064-7000-8000-${String(idIndex++).padStart(12, "0")}`,
      () => new Date("2026-08-13T06:00:00.000Z"),
    );
    const visits = Array.from({ length: 20 }, (_, index) => createVisit(index + 1));
    await controller.hydrate(visits);

    for (const visit of visits) {
      await controller.start(visit.id);
      for (const act of visit.acts) await controller.setActPerformed(visit.id, act.id, true);
      await controller.complete(visit.id);
    }

    expect(await controller.list()).toHaveLength(20);
    expect((await controller.list()).every(({ status }) => status === "done")).toBe(true);
    expect(await queue.replayable()).toHaveLength(80);

    const delivered = new Set<string>();
    let online = false;
    const engine = new SyncEngine(queue, async (action) => {
      if (!online) throw new Error("mode avion");
      delivered.add(action.idempotencyKey);
    });
    await expect(engine.flush()).resolves.toEqual({ synced: 0, failed: 80 });
    online = true;
    await expect(Promise.all([engine.flush(), engine.flush()])).resolves.toEqual([
      { synced: 80, failed: 0 },
      { synced: 80, failed: 0 },
    ]);
    await expect(engine.flush()).resolves.toEqual({ synced: 0, failed: 0 });
    expect(delivered.size).toBe(80);
  });

  it("remplace entièrement l'ancienne tournée lors d'une hydratation serveur", async () => {
    const storage = new InMemoryOfflineTourStorage();
    const queue = new ActionQueue(new InMemoryQueueStorage());
    const controller = new OfflineTourController(
      storage,
      queue,
      () => "0198f54c-4064-7000-8000-000000099999",
    );
    await controller.hydrate([createVisit(1), createVisit(2)]);
    await controller.hydrate([createVisit(3)]);
    await expect(controller.list()).resolves.toEqual([createVisit(3)]);
  });
});
