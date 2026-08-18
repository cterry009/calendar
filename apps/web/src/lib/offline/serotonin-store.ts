import type { SerotoninSession } from '@calendar/shared';
import type { StoredSerotoninDay } from '../calendar/types';
import { IDB_STORES, idbGet, idbPut } from './idb';

const SEROTONIN_KEY = 'current';

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadTodayRaw(): Promise<StoredSerotoninDay | null> {
  const stored = await idbGet<StoredSerotoninDay>(IDB_STORES.serotoninSession, SEROTONIN_KEY);
  if (!stored || stored.date !== todayKey()) {
    return null;
  }
  return stored;
}

/** Wellness tracking rolls over daily -- a session saved for a previous day is not "today's". */
export async function loadTodaySerotoninSession(): Promise<SerotoninSession | null> {
  const stored = await loadTodayRaw();
  return stored?.session ?? null;
}

export async function saveSerotoninSession(session: SerotoninSession): Promise<void> {
  await idbPut<StoredSerotoninDay>(IDB_STORES.serotoninSession, { date: todayKey(), session }, SEROTONIN_KEY);
}

/** Overwrites the local cache with a session pulled from the server (already known to be today's). */
export async function cacheServerSerotoninSession(day: StoredSerotoninDay): Promise<void> {
  await idbPut<StoredSerotoninDay>(IDB_STORES.serotoninSession, day, SEROTONIN_KEY);
}
