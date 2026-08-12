import { z } from "zod";

export const syncActionSchema = z.object({
  id: z.uuid(),
  idempotencyKey: z.string().min(1).max(200),
  kind: z.string().min(1).max(100),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
});

export type SyncActionInput = z.infer<typeof syncActionSchema>;
export type SyncActionStatus = "pending" | "processing" | "synced" | "failed";
export type StoredSyncAction = SyncActionInput & {
  status: SyncActionStatus;
  attempts: number;
  lastError: string | null;
};
