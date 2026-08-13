import { describe, expect, it } from "vitest";

import {
  ActionQueue,
  InMemoryOfflineTourStorage,
  InMemoryQueueStorage,
  OfflineTourController,
  type OfflineVisit,
} from "../src/index.js";

function createVisit(overrides: Partial<OfflineVisit> = {}): OfflineVisit {
  return {
    id: "visit-a",
    patientId: "patient-a",
    patientDisplayName: "Patiente fictive",
    address: "1 rue de la Démonstration",
    scheduledAt: "2026-08-13T08:00:00.000Z",
    estimatedArrivalAt: "2026-08-13T08:00:00.000Z",
    estimatedDurationMin: 15,
    travelFromPreviousMin: 5,
    status: "planned",
    localVersion: 0,
    acts: [{ id: "act-a", label: "Pansement", performed: false }],
    exception: null,
    ...overrides,
  };
}

function createController() {
  const storage = new InMemoryOfflineTourStorage();
  const queue = new ActionQueue(new InMemoryQueueStorage());
  let id = 0;
  const controller = new OfflineTourController(
    storage,
    queue,
    () => `0198f54c-4064-7000-8000-${String(id += 1).padStart(12, "0")}`,
    () => new Date("2026-08-13T07:30:00.000Z"),
  );
  return { controller, queue, storage };
}

describe("offline tour safeguards", () => {
  it("keeps stored visits isolated and can purge a lost device", async () => {
    const storage = new InMemoryOfflineTourStorage();
    const source = createVisit();
    await storage.putVisit(source);
    source.acts[0]!.performed = true;

    const firstRead = await storage.getVisit(source.id);
    expect(firstRead?.acts[0]?.performed).toBe(false);
    firstRead!.patientDisplayName = "Mutation locale";
    expect((await storage.getVisit(source.id))?.patientDisplayName).toBe("Patiente fictive");
    await expect(storage.getVisit("unknown")).resolves.toBeNull();

    await storage.purge();
    await expect(storage.listVisits()).resolves.toEqual([]);
  });

  it("rejects unknown or non-planned visits and makes start idempotent", async () => {
    const { controller, queue } = createController();
    await controller.hydrate([createVisit()]);

    await expect(controller.start("unknown")).rejects.toThrow("introuvable");
    const started = await controller.start("visit-a");
    await expect(controller.start("visit-a")).resolves.toEqual(started);
    expect(await queue.replayable()).toHaveLength(1);

    await controller.hydrate([createVisit({ status: "missed" })]);
    await expect(controller.start("visit-a")).rejects.toThrow("planifié");
  });

  it("requires an active visit and a known, fully completed checklist", async () => {
    const { controller, queue } = createController();
    await controller.hydrate([createVisit()]);

    await expect(controller.setActPerformed("visit-a", "act-a", true)).rejects.toThrow("Démarrez");
    await expect(controller.complete("visit-a")).rejects.toThrow("pas en cours");
    await controller.start("visit-a");
    await expect(controller.setActPerformed("visit-a", "unknown", true)).rejects.toThrow("introuvable");
    await expect(controller.complete("visit-a")).rejects.toThrow("Confirmez");

    await controller.setActPerformed("visit-a", "act-a", true);
    await controller.setActPerformed("visit-a", "act-a", false);
    await expect(controller.complete("visit-a")).rejects.toThrow("Confirmez");
    await controller.setActPerformed("visit-a", "act-a", true);
    const completed = await controller.complete("visit-a");
    await expect(controller.complete("visit-a")).resolves.toEqual(completed);
    expect(await queue.replayable()).toHaveLength(5);
  });

  it("rejects completion when the passage has no acts", async () => {
    const { controller } = createController();
    await controller.hydrate([createVisit({ acts: [] })]);
    await controller.start("visit-a");
    await expect(controller.complete("visit-a")).rejects.toThrow("Confirmez");
  });

  it.each([
    ["absence", "missed"],
    ["refusal", "refused"],
    ["hospitalization", "cancelled"],
    ["emergency", "cancelled"],
  ] as const)("maps %s to %s", async (exception, expectedStatus) => {
    const { controller } = createController();
    await controller.hydrate([createVisit()]);
    const updated = await controller.recordException("visit-a", exception, "Contexte validé");
    expect(updated).toMatchObject({ status: expectedStatus, exception: { type: exception } });
  });

  it("requires a date for rescheduling and recalculates the remaining route", async () => {
    const { controller, queue } = createController();
    await controller.hydrate([
      createVisit({ id: "terminal", status: "done", scheduledAt: "2026-08-13T07:00:00.000Z" }),
      createVisit(),
      createVisit({
        id: "visit-b",
        scheduledAt: "2026-08-13T08:01:00.000Z",
        estimatedArrivalAt: "2026-08-13T08:01:00.000Z",
        travelFromPreviousMin: 10,
      }),
    ]);

    await expect(controller.recordException("visit-a", "reschedule", null)).rejects.toThrow("nouvelle date");
    const rescheduled = await controller.recordException(
      "visit-a",
      "reschedule",
      "À la demande de la patiente",
      "2026-08-13T09:00:00.000Z",
    );

    expect(rescheduled).toMatchObject({
      status: "planned",
      scheduledAt: "2026-08-13T09:00:00.000Z",
      estimatedArrivalAt: "2026-08-13T09:00:00.000Z",
    });
    expect((await controller.list()).find(({ id }) => id === "visit-b")?.estimatedArrivalAt)
      .toBe("2026-08-13T08:01:00.000Z");
    expect((await queue.replayable())[0]?.payload).toMatchObject({
      type: "reschedule",
      rescheduledAt: "2026-08-13T09:00:00.000Z",
    });
  });
});
