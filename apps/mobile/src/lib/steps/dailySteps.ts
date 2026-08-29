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

// Task 11.1: the OS/OEM hardware step-counter chip (not raw accelerometer -- watchStepCount goes
// through TYPE_STEP_COUNTER) occasionally reports a burst of "steps" from a vibration or a tap on
// a table, well beyond anything a person could have walked/run in that span. This clamps a raw
// delta against the max plausible sustained cadence for however long it was accumulated over, so
// a burst can inflate the count a little but never wildly.
const MAX_STEPS_PER_MINUTE = 220;

export function clampSessionSteps(rawSteps: number, elapsedMs: number): number {
  if (rawSteps <= 0) return 0;
  if (elapsedMs <= 0) return rawSteps;
  const maxPlausible = Math.ceil((elapsedMs / 60_000) * MAX_STEPS_PER_MINUTE);
  return Math.min(rawSteps, maxPlausible);
}

// Called when a foreground step-counting session ends with `sessionSteps` steps taken during
// that session -- folds them into today's persisted total and returns the new total. A stale
// baseline from a previous day is dropped, not added to (a fresh day starts at 0, not wherever
// yesterday left off). Callers are expected to have already run the delta through
// `clampSessionSteps`; this is not re-clamped here since the caller has the timing context.
export async function foldSessionIntoBaseline(sessionSteps: number): Promise<number> {
  const current = await getStepsBaseline();
  const next = current + Math.max(0, sessionSteps);
  const stored: StoredBaseline = { dayKey: todayKey(), baseline: next };
  await platformStorage.setItem(BASELINE_KEY, JSON.stringify(stored));
  return next;
}
