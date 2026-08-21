import { platformStorage } from '../platformStorage';

const BASELINE_KEY = 'calendar_daily_steps_baseline_v1';

interface StoredBaseline {
  dayKey: string;
  baseline: number;
}

// Android's step sensor only reports live deltas while the app is in the foreground -- see
// useDailySteps.ts for why (Pedometer.watchStepCount, not a background-capable API). This is the
// piece that turns those short-lived deltas into a running "today's total": each foreground
// session's delta gets folded into a persisted baseline when the session ends (app backgrounds or
// unmounts), so the next session's delta-since-zero starts accumulating on top of the right
// number instead of on top of zero every time the app reopens.
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getStepsBaseline(): Promise<number> {
  const raw = await platformStorage.getItem(BASELINE_KEY);
  if (!raw) return 0;

  const stored = JSON.parse(raw) as StoredBaseline;
  return stored.dayKey === todayKey() ? stored.baseline : 0;
}

// Called when a foreground step-counting session ends with `sessionSteps` steps taken during
// that session -- folds them into today's persisted total and returns the new total. A stale
// baseline from a previous day is dropped, not added to (a fresh day starts at 0, not wherever
// yesterday left off).
export async function foldSessionIntoBaseline(sessionSteps: number): Promise<number> {
  const current = await getStepsBaseline();
  const next = current + Math.max(0, sessionSteps);
  const stored: StoredBaseline = { dayKey: todayKey(), baseline: next };
  await platformStorage.setItem(BASELINE_KEY, JSON.stringify(stored));
  return next;
}
