import { IDB_STORES, idbGet, idbPut } from './idb';

export interface DailyRitualState {
  date: string;
  morningCompletedAt?: string;
  eveningCompletedAt?: string;
  reflection?: string;
}

const RITUAL_KEY = 'current';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createEmptyRitualState(): DailyRitualState {
  return { date: todayKey() };
}

/** Rolls over daily -- a ritual state saved for a previous day is not "today's". */
export async function loadTodayRitual(): Promise<DailyRitualState> {
  const stored = await idbGet<DailyRitualState>(IDB_STORES.dailyRitual, RITUAL_KEY);
  if (!stored || stored.date !== todayKey()) {
    return createEmptyRitualState();
  }
  return stored;
}

export async function saveTodayRitual(state: DailyRitualState): Promise<void> {
  await idbPut<DailyRitualState>(IDB_STORES.dailyRitual, state, RITUAL_KEY);
}
