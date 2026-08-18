import { getCompletionTier } from '@calendar/shared';
import type { HabitCellVisualState } from './labels';
import type { SyncHabit, SyncHabitRecord } from './types';

export function dateKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

export function todayKey(): string {
  return dateKey(new Date());
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
