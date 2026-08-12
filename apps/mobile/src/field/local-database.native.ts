import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";

import type {
  OfflineTourStorage,
  OfflineVisit,
  QueueStorage,
  StoredSyncAction,
} from "@idel-os/sync";

const databaseName = "idel-os-field.db";
const keyName = "idel-os.field.sqlcipher-key.v1";
const deviceName = "idel-os.field.device-id.v1";

export class EncryptedFieldDatabase implements QueueStorage, OfflineTourStorage {
  private constructor(private readonly database: SQLite.SQLiteDatabase) {}

  public static async open(): Promise<EncryptedFieldDatabase> {
    const key = await getOrCreateDatabaseKey();
    const database = await SQLite.openDatabaseAsync(databaseName);
    await database.execAsync(`
      PRAGMA key = "x'${key}'";
      PRAGMA cipher_memory_security = ON;
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS offline_visits (
        id TEXT PRIMARY KEY NOT NULL,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sync_actions (
        id TEXT PRIMARY KEY NOT NULL,
        idempotency_key TEXT UNIQUE NOT NULL,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    return new EncryptedFieldDatabase(database);
  }

  public async listVisits(): Promise<OfflineVisit[]> {
    const rows = await this.database.getAllAsync<{ payload_json: string }>(
      "SELECT payload_json FROM offline_visits ORDER BY updated_at",
    );
    return rows.map(({ payload_json }) => JSON.parse(payload_json) as OfflineVisit);
  }

  public async getVisit(id: string): Promise<OfflineVisit | null> {
    const row = await this.database.getFirstAsync<{ payload_json: string }>(
      "SELECT payload_json FROM offline_visits WHERE id = ?",
      id,
    );
    return row === null ? null : JSON.parse(row.payload_json) as OfflineVisit;
  }

  public async putVisit(visit: OfflineVisit): Promise<void> {
    await this.database.runAsync(
      `INSERT INTO offline_visits (id, payload_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at`,
      visit.id,
      JSON.stringify(visit),
      new Date().toISOString(),
    );
  }

  public async replaceVisits(visits: OfflineVisit[]): Promise<void> {
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync("DELETE FROM offline_visits");
      for (const visit of visits) {
        await transaction.runAsync(
          "INSERT INTO offline_visits (id, payload_json, updated_at) VALUES (?, ?, ?)",
          visit.id,
          JSON.stringify(visit),
          new Date().toISOString(),
        );
      }
    });
  }

  public async list(): Promise<StoredSyncAction[]> {
    const rows = await this.database.getAllAsync<{ payload_json: string }>(
      "SELECT payload_json FROM sync_actions ORDER BY updated_at",
    );
    return rows.map(({ payload_json }) => JSON.parse(payload_json) as StoredSyncAction);
  }

  public async get(id: string): Promise<StoredSyncAction | null> {
    const row = await this.database.getFirstAsync<{ payload_json: string }>(
      "SELECT payload_json FROM sync_actions WHERE id = ?",
      id,
    );
    return row === null ? null : JSON.parse(row.payload_json) as StoredSyncAction;
  }

  public async put(action: StoredSyncAction): Promise<void> {
    await this.database.runAsync(
      `INSERT INTO sync_actions (id, idempotency_key, payload_json, status, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json, status = excluded.status, updated_at = excluded.updated_at`,
      action.id,
      action.idempotencyKey,
      JSON.stringify(action),
      action.status,
      new Date().toISOString(),
    );
  }

  public async purge(): Promise<void> {
    await this.database.closeAsync();
    await SQLite.deleteDatabaseAsync(databaseName);
    await SecureStore.deleteItemAsync(keyName);
  }
}

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(deviceName);
  if (existing !== null) return existing;
  const id = Crypto.randomUUID();
  await SecureStore.setItemAsync(deviceName, id, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
  return id;
}

async function getOrCreateDatabaseKey(): Promise<string> {
  const options: SecureStore.SecureStoreOptions = {
    requireAuthentication: true,
    authenticationPrompt: "Déverrouillez votre tournée IDEL OS",
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  };
  const existing = await SecureStore.getItemAsync(keyName, options);
  if (existing !== null) return existing;
  const bytes = Crypto.getRandomBytes(32);
  const key = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  await SecureStore.setItemAsync(keyName, key, options);
  return key;
}
