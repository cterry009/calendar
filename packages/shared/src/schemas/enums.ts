import { z } from 'zod';

export const DevicePlatformSchema = z.enum([
  'WEB',
  'ANDROID',
  'IOS',
  'WINDOWS',
  'MACOS',
]);

export const TaskDifficultySchema = z.enum(['EASY', 'MEDIUM', 'HARD']);
export const TaskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const TaskStatusSchema = z.enum([
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);

export const ScheduleKindSchema = z.enum(['WORK', 'REST']);

export const PomodoroStateSchema = z.enum([
  'IDLE',
  'FOCUS',
  'SHORT_BREAK',
  'LONG_BREAK',
]);

export const BlockListKindSchema = z.enum([
  'MOBILE_APP',
  'WEBSITE',
  'DESKTOP_APP',
]);

// Task 11.8: which trigger a BlockListEntry belongs to -- FOCUS (pomodoro/work-hours, the
// pre-existing default) or NIGHT (the automatic 22:30-08:00 window, task 11.10), a deliberately
// separate list per the user's request, not a filtered view of the same one.
export const BlockListScopeSchema = z.enum(['FOCUS', 'NIGHT']);

export const FitnessIntensitySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const FitnessSourceSchema = z.enum([
  'MANUAL',
  'HEALTH_CONNECT',
  'HEALTHKIT',
  'CSV_IMPORT',
  'DEVICE_SENSOR',
]);

export const HabitTypeSchema = z.enum(['NORMAL', 'NEGATIVE']);
export const HabitRecordStatusSchema = z.enum(['DONE', 'SKIPPED']);

export const FocusTriggerKindSchema = z.enum(['LOCATION', 'WIFI']);

export type DevicePlatform = z.infer<typeof DevicePlatformSchema>;
export type TaskDifficulty = z.infer<typeof TaskDifficultySchema>;
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type ScheduleKind = z.infer<typeof ScheduleKindSchema>;
export type PomodoroState = z.infer<typeof PomodoroStateSchema>;
export type BlockListKind = z.infer<typeof BlockListKindSchema>;
export type BlockListScope = z.infer<typeof BlockListScopeSchema>;
export type FitnessIntensity = z.infer<typeof FitnessIntensitySchema>;
export type FitnessSource = z.infer<typeof FitnessSourceSchema>;
export type HabitType = z.infer<typeof HabitTypeSchema>;
export type HabitRecordStatus = z.infer<typeof HabitRecordStatusSchema>;
export type FocusTriggerKind = z.infer<typeof FocusTriggerKindSchema>;
