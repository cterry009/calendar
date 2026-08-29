import type { HabitRecordStatus, HabitType } from '@calendar/shared';

export type { SyncHabit, SyncHabitRecord } from '../calendar/types';

// Mirrors apps/web/src/lib/habits/types.ts, minus journal-entry support (see calendar/types.ts's
// doc comment on why that's out of scope for this port).
export const HABIT_TYPES: HabitType[] = ['NORMAL', 'NEGATIVE'];
export const HABIT_RECORD_STATUSES: HabitRecordStatus[] = ['DONE', 'SKIPPED'];

export interface HabitFormValues {
  title: string;
  description: string | null;
  type: HabitType;
  dailyGoalValue: number;
  dailyGoalUnit: string;
  dailyGoalExtraValue: number | null;
  targetDays: number;
  color: string | null;
  category: string | null;
  linkedFitnessActivityType: string | null;
  // Optional reminder window (task 11.5/11.6) -- undefined in the plain create form (HabitForm.tsx
  // doesn't collect these), set by the quick-add templates (task 11.7) that need a specific time.
  reminderStartMinute?: number | null;
  reminderEndMinute?: number | null;
  reminderDaysOfWeek?: number[];
}

export interface HabitCheckInValues {
  date: string;
  value: number;
  status: HabitRecordStatus;
}
