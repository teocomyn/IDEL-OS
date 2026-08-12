import { describe, expect, it } from "vitest";

import { ActionQueue, InMemoryQueueStorage } from "../src/action-queue.js";

describe("ActionQueue", () => {
  it("persists an action before exposing it", async () => {
    const storage = new InMemoryQueueStorage();
    const queue = new ActionQueue(storage);
    await queue.enqueue({
      id: "0198f54c-4064-7000-8000-000000000010",
      idempotencyKey: "patient:create:synthetic-1",
      kind: "patient.create",
      payload: { clientId: "synthetic-1" },
      createdAt: "2026-08-12T08:00:00.000Z",
    });

    await expect(queue.pending()).resolves.toHaveLength(1);
  });

  it("deduplicates actions by idempotency key", async () => {
    const queue = new ActionQueue(new InMemoryQueueStorage());
    const action = {
      id: "0198f54c-4064-7000-8000-000000000011",
      idempotencyKey: "patient:update:synthetic-1:v2",
      kind: "patient.update",
      payload: { clientId: "synthetic-1", version: 2 },
      createdAt: "2026-08-12T08:00:00.000Z",
    } as const;

    await queue.enqueue(action);
    await queue.enqueue({ ...action, id: "0198f54c-4064-7000-8000-000000000012" });
    await expect(queue.pending()).resolves.toHaveLength(1);
  });

  it("keeps failed actions replayable", async () => {
    const queue = new ActionQueue(new InMemoryQueueStorage());
    await queue.enqueue({
      id: "0198f54c-4064-7000-8000-000000000013",
      idempotencyKey: "patient:update:synthetic-2:v3",
      kind: "patient.update",
      payload: {},
      createdAt: "2026-08-12T08:00:00.000Z",
    });
    await queue.markProcessing("0198f54c-4064-7000-8000-000000000013");
    await queue.markFailed("0198f54c-4064-7000-8000-000000000013", "network_unavailable");

    const [failed] = await queue.replayable();
    expect(failed?.status).toBe("failed");
    expect(failed?.attempts).toBe(1);
  });

  it("marks successfully delivered actions as synced", async () => {
    const queue = new ActionQueue(new InMemoryQueueStorage());
    const id = "0198f54c-4064-7000-8000-000000000014";
    await queue.enqueue({
      id,
      idempotencyKey: "patient:create:synthetic-3",
      kind: "patient.create",
      payload: {},
      createdAt: "2026-08-12T08:00:00.000Z",
    });
    await queue.markProcessing(id);
    await queue.markSynced(id);
    await expect(queue.replayable()).resolves.toEqual([]);
  });

  it("rejects state changes for unknown actions", async () => {
    const queue = new ActionQueue(new InMemoryQueueStorage());
    await expect(
      queue.markProcessing("0198f54c-4064-7000-8000-000000000099"),
    ).rejects.toThrow("Unknown sync action");
  });
});
