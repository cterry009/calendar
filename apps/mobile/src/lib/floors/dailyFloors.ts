import { platformStorage } from '../platformStorage';

const BASELINE_KEY = 'calendar_daily_floors_baseline_v1';

interface StoredBaseline {
  dayKey: string;
  baseline: number;
}

// Same session-fold pattern as apps/mobile/src/lib/steps/dailySteps.ts: the barometer (like the
// step sensor) only reports live altitude changes while the app is foregrounded, so each
// foreground session's floor count gets folded into a persisted daily baseline when the session
// ends.
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getFloorsBaseline(): Promise<number> {
  const raw = await platformStorage.getItem(BASELINE_KEY);
  if (!raw) return 0;

  const stored = JSON.parse(raw) as StoredBaseline;
  return stored.dayKey === todayKey() ? stored.baseline : 0;
}

export async function foldSessionIntoFloorsBaseline(sessionFloors: number): Promise<number> {
  const current = await getFloorsBaseline();
  const next = current + Math.max(0, sessionFloors);
  const stored: StoredBaseline = { dayKey: todayKey(), baseline: next };
  await platformStorage.setItem(BASELINE_KEY, JSON.stringify(stored));
  return next;
}
