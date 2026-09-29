import type { HabitRecordStatus, HabitType } from '@calendar/shared';

export type { SyncHabit, SyncHabitRecord, SyncJournalEntry } from '../calendar/types';

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
  // Time block (lib/habits/timeBlock.ts). Always sent: the server replaces the whole habit on
  // every edit, so leaving these out used to wipe a block set from the phone.
  reminderStartMinute: number | null;
  reminderEndMinute: number | null;
  reminderDaysOfWeek: number[];
}

export interface HabitCheckInValues {
  date: string;
  value: number;
  status: HabitRecordStatus;
}
