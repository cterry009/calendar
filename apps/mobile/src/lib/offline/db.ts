import * as SQLite from 'expo-sqlite';
import type { SyncSnapshot } from '../calendar/types';

// Native equivalent of apps/web/src/lib/offline/idb.ts: same "one JSON blob cache + one
// append-only queue table" shape, SQLite instead of IndexedDB (expo-sqlite has a web
// implementation too, so this also runs under `expo start --web`, the only verification path
// available in this environment). Deliberately NOT normalized into per-entity tables -- same
// simplicity/trade-offs as the web version, see design.md decision for why that's a reasonable
// v1 scope instead of a bigger relational-cache rewrite.
const DB_NAME = 'calendar-offline.db';
const SNAPSHOT_KEY = 'latest';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function openDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS snapshots (
          key TEXT PRIMARY KEY NOT NULL,
          data TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sync_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity TEXT NOT NULL,
          payload TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);
      return db;
    });
  }
  return dbPromise;
}

export async function getCachedSnapshot(): Promise<SyncSnapshot | null> {
  const db = await openDb();
  const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM snapshots WHERE key = ?', [SNAPSHOT_KEY]);
  if (!row) return null;

  try {
    return JSON.parse(row.data) as SyncSnapshot;
  } catch {
    return null;
  }
}

export async function saveCachedSnapshot(snapshot: SyncSnapshot): Promise<void> {
  const db = await openDb();
  await db.runAsync('INSERT OR REPLACE INTO snapshots (key, data) VALUES (?, ?)', [SNAPSHOT_KEY, JSON.stringify(snapshot)]);
}

export interface SyncQueueRow {
  id: number;
  entity: string;
  payload: string;
  created_at: string;
}

export async function enqueueSyncItem(entity: string, payload: unknown[]): Promise<void> {
  const db = await openDb();
  await db.runAsync('INSERT INTO sync_queue (entity, payload, created_at) VALUES (?, ?, ?)', [
    entity,
    JSON.stringify(payload),
    new Date().toISOString(),
  ]);
}

export async function getSyncQueue(): Promise<SyncQueueRow[]> {
  const db = await openDb();
  return db.getAllAsync<SyncQueueRow>('SELECT * FROM sync_queue ORDER BY created_at ASC, id ASC');
}

export async function clearSyncQueue(): Promise<void> {
  const db = await openDb();
  await db.execAsync('DELETE FROM sync_queue');
}

export async function getSyncQueueCount(): Promise<number> {
  const db = await openDb();
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM sync_queue');
  return row?.count ?? 0;
}
