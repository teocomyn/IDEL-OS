import { describe, expect, it } from "vitest";

import { ActionQueue, InMemoryQueueStorage } from "../src/action-queue.js";
import { SyncEngine } from "../src/sync-engine.js";

describe("SyncEngine", () => {
  it("flushes successful actions exactly once", async () => {
    const queue = new ActionQueue(new InMemoryQueueStorage());
    await queue.enqueue({
      id: "0198f54c-4064-7000-8000-000000000030",
      idempotencyKey: "visit:update:synthetic-1",
      kind: "visit.update",
      payload: {},
      createdAt: "2026-08-12T08:00:00.000Z",
    });
    let calls = 0;
    const engine = new SyncEngine(queue, async () => {
      calls += 1;
    });

    await expect(engine.flush()).resolves.toEqual({ synced: 1, failed: 0 });
    await expect(engine.flush()).resolves.toEqual({ synced: 0, failed: 0 });
    expect(calls).toBe(1);
  });

  it("keeps transport failures replayable", async () => {
    const queue = new ActionQueue(new InMemoryQueueStorage());
    await queue.enqueue({
      id: "0198f54c-4064-7000-8000-000000000031",
      idempotencyKey: "visit:update:synthetic-2",
      kind: "visit.update",
      payload: {},
      createdAt: "2026-08-12T08:00:00.000Z",
    });
    const engine = new SyncEngine(queue, async () => {
      throw new Error("synthetic network failure");
    });

    await expect(engine.flush()).resolves.toEqual({ synced: 0, failed: 1 });
    await expect(queue.replayable()).resolves.toHaveLength(1);
  });
});
