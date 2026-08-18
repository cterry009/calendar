import { computeHabitScore, getCompletionTier } from '@calendar/shared';
import type { HabitCellVisualState } from './labels';
import type { SyncHabit, SyncHabitRecord } from './types';

export function dateKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

export function todayKey(): string {
  return dateKey(new Date());
}

export function shiftDateKey(key: string, deltaDays: number): string {
  const d = new Date(`${key}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return dateKey(d);
}

export function daysBetween(startKey: string, endKey: string): number {
  const start = new Date(`${startKey}T00:00:00.000Z`).getTime();
  const end = new Date(`${endKey}T00:00:00.000Z`).getTime();
  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}

export function findRecordForDate(
  records: SyncHabitRecord[],
  habitId: string,
  key: string,
): SyncHabitRecord | undefined {
  return records.find((record) => record.habitId === habitId && dateKey(record.date) === key);
}

export function hasRecordForDate(records: SyncHabitRecord[], habitId: string, key: string): boolean {
  return findRecordForDate(records, habitId, key) !== undefined;
}

export function habitCellVisualState(
  habit: Pick<SyncHabit, 'type' | 'dailyGoalValue' | 'dailyGoalExtraValue'>,
  record: SyncHabitRecord | undefined,
  key: string,
): HabitCellVisualState {
  if (key > todayKey()) return 'future';
  if (!record) return 'empty';
  if (record.status === 'SKIPPED') return 'skipped';

  const tier = getCompletionTier(habit.type, record.value, habit.dailyGoalValue, habit.dailyGoalExtraValue);
  if (record.autoCompleted) return 'auto';
  if (tier === 'OK') return 'done';
  if (tier === 'GOODJOB') return 'exceeded';
  return 'partial'; // TRYHARD, NO_EFFECT, or ZERO logged that day
}

/** Oldest-to-newest date keys, `n` days ending at `endKey` (default: today). */
export function lastNDateKeys(n: number, endKey: string = todayKey()): string[] {
  const end = new Date(`${endKey}T00:00:00.000Z`);
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const day = new Date(end);
    day.setUTCDate(day.getUTCDate() - i);
    keys.push(dateKey(day));
  }
  return keys;
}

/**
 * Consecutive DONE days ending today (or yesterday, if today hasn't been logged yet -- a streak
 * isn't broken just because the day isn't over). Deliberately separate from the mhabit-ported
 * score: mhabit shows both a simple streak ("kept it up for N days") and the sigmoid score side
 * by side, and the score is explicitly not streak-based.
 */
export function computeCurrentStreak(
  habitId: string,
  records: SyncHabitRecord[],
  today: string = todayKey(),
): number {
  let cursor = hasRecordForDate(records, habitId, today) ? today : shiftDateKey(today, -1);
  let streak = 0;

  while (true) {
    const record = findRecordForDate(records, habitId, cursor);
    if (!record || record.status !== 'DONE' || record.value <= 0) break;
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }

  return streak;
}

export interface ScoreHistoryPoint {
  date: string;
  score: number;
}

/**
 * Score at `points` evenly-spaced dates from habit creation to today, by replaying
 * computeHabitScore with different `asOf` values -- cheap since it's O(records) per call, not
 * O(days), same reasoning as computeHabitScore itself.
 */
export function sampleScoreHistory(
  habit: Pick<SyncHabit, 'type' | 'targetDays' | 'dailyGoalValue' | 'dailyGoalExtraValue' | 'createdAt'>,
  records: SyncHabitRecord[],
  points = 8,
): ScoreHistoryPoint[] {
  const createdKey = dateKey(habit.createdAt);
  const today = todayKey();
  const totalDays = Math.max(0, daysBetween(createdKey, today));
  const mappedRecords = records.map((r) => ({
    date: r.date,
    value: r.value,
    status: r.status,
    autoCompleted: r.autoCompleted,
  }));

  const scoreAsOf = (asOf: string) =>
    computeHabitScore({
      type: habit.type,
      targetDays: habit.targetDays,
      dailyGoalValue: habit.dailyGoalValue,
      dailyGoalExtraValue: habit.dailyGoalExtraValue,
      createdAt: habit.createdAt,
      records: mappedRecords,
      asOf,
    });

  const sampleKeys = new Set<string>();
  const denom = Math.max(1, points - 1);
  for (let i = 0; i < points; i++) {
    sampleKeys.add(shiftDateKey(createdKey, Math.round((totalDays * i) / denom)));
  }
  sampleKeys.add(today);

  return [...sampleKeys]
    .sort()
    .map((date) => ({ date, score: scoreAsOf(date) }));
}
