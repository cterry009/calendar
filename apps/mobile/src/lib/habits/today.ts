import type { SyncHabitRecord } from './types';

// Trimmed port of apps/web/src/lib/habits/today.ts -- just the date-key helpers and record lookup
// the mobile list/check-in screen and notification response handler need. Web's streak/score-
// history sampling (calendar-grid-specific) isn't ported; the mobile screen is a flat list, not a
// grid.
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
