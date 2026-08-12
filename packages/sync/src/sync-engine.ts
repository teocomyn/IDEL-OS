import type { ActionQueue } from "./action-queue.js";
import type { StoredSyncAction } from "./sync-contract.js";

export type SyncTransport = (action: StoredSyncAction) => Promise<void>;

export class SyncEngine {
  private flushing: Promise<{ synced: number; failed: number }> | null = null;

  public constructor(
    private readonly queue: ActionQueue,
    private readonly transport: SyncTransport,
  ) {}

  public async flush(): Promise<{ synced: number; failed: number }> {
    if (this.flushing !== null) return this.flushing;
    this.flushing = this.flushOnce();
    try {
      return await this.flushing;
    } finally {
      this.flushing = null;
    }
  }

  private async flushOnce(): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;
    for (const action of await this.queue.replayable()) {
      await this.queue.markProcessing(action.id);
      try {
        await this.transport(action);
        await this.queue.markSynced(action.id);
        synced += 1;
      } catch {
        await this.queue.markFailed(action.id, "transport_failed");
        failed += 1;
      }
    }
    return { synced, failed };
  }
}
