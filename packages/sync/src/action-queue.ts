import { syncActionSchema, type StoredSyncAction, type SyncActionInput } from "./sync-contract.js";

export interface QueueStorage {
  list(): Promise<StoredSyncAction[]>;
  put(action: StoredSyncAction): Promise<void>;
  get(id: string): Promise<StoredSyncAction | null>;
}

export class InMemoryQueueStorage implements QueueStorage {
  private readonly actions = new Map<string, StoredSyncAction>();

  public async list(): Promise<StoredSyncAction[]> {
    return [...this.actions.values()].map((action) => structuredClone(action));
  }

  public async put(action: StoredSyncAction): Promise<void> {
    this.actions.set(action.id, structuredClone(action));
  }

  public async get(id: string): Promise<StoredSyncAction | null> {
    const action = this.actions.get(id);
    return action === undefined ? null : structuredClone(action);
  }
}

export class ActionQueue {
  public constructor(private readonly storage: QueueStorage) {}

  public async enqueue(input: SyncActionInput): Promise<void> {
    const action = syncActionSchema.parse(input);
    const duplicate = (await this.storage.list()).find(
      (candidate) => candidate.idempotencyKey === action.idempotencyKey,
    );
    if (duplicate !== undefined) return;
    await this.storage.put({ ...action, status: "pending", attempts: 0, lastError: null });
  }

  public async pending(): Promise<StoredSyncAction[]> {
    return (await this.storage.list()).filter((action) => action.status === "pending");
  }

  public async replayable(): Promise<StoredSyncAction[]> {
    return (await this.storage.list()).filter(
      (action) => action.status === "pending" || action.status === "failed",
    );
  }

  public async markProcessing(id: string): Promise<void> {
    await this.update(id, { status: "processing", incrementAttempts: true });
  }

  public async markFailed(id: string, lastError: string): Promise<void> {
    await this.update(id, { status: "failed", lastError, incrementAttempts: false });
  }

  public async markSynced(id: string): Promise<void> {
    await this.update(id, { status: "synced", lastError: null, incrementAttempts: false });
  }

  private async update(
    id: string,
    change: {
      status: StoredSyncAction["status"];
      incrementAttempts: boolean;
      lastError?: string | null;
    },
  ): Promise<void> {
    const current = await this.storage.get(id);
    if (current === null) throw new Error(`Unknown sync action: ${id}`);
    await this.storage.put({
      ...current,
      status: change.status,
      attempts: current.attempts + (change.incrementAttempts ? 1 : 0),
      lastError: change.lastError === undefined ? current.lastError : change.lastError,
    });
  }
}
