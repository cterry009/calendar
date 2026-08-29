import type { HabitRecordStatus, HabitType, TaskDifficulty, TaskPriority, TaskStatus } from '@calendar/shared';
import type { SyncBlockListRecord } from '../blocklist/types';
import type { SyncFitnessRecord } from '../fitness/types';
import type { SyncFloorsClimbedRecord } from '../floors/types';
import type { SyncPomodoroRecord } from '../pomodoro/types';
import type { SyncStepCountRecord } from '../steps/types';

// Mirrors apps/web/src/lib/tasks/types.ts's SyncTaskRecord -- the server's sync payload adds
// createdAt/updatedAt/deletedAt on top of the pure @calendar/shared Task schema.
export interface SyncTaskRecord {
  id: string;
  clientId: string | null;
  title: string;
  description: string | null;
  scheduledAt: string | null;
  estimatedMinutes: number;
  estimatedPomodoros: number | null;
  actualMinutes: number | null;
  difficulty: TaskDifficulty;
  complexity: number;
  priority: TaskPriority;
  category: string | null;
  status: TaskStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface SyncScheduleRecord {
  id: string;
  kind: 'WORK' | 'REST';
  daysOfWeek: number[]; // 0=Sunday..6=Saturday, matches JS Date.getDay()
  startMinute: number;
  endMinute: number;
  label: string | null;
  enabled: boolean;
  pomodoroMin: number | null;
  shortBreakMin: number | null;
  longBreakMin: number | null;
  pomodorosPerChunk: number | null;
  chunks: number | null;
}

// Mirrors apps/web/src/lib/calendar/types.ts's SyncHabit/SyncHabitRecord (task 11.4's mobile
// port). Journal entries (free-text notes attached to a check-in) aren't ported here -- the
// user's request was daily habits with a yes/no confirmation, not journaling, and web's
// SyncJournalEntry is independently useful without it.
export interface SyncHabit {
  id: string;
  clientId: string | null;
  title: string;
  description: string | null;
  type: HabitType;
  dailyGoalValue: number;
  dailyGoalUnit: string;
  dailyGoalExtraValue: number | null;
  targetDays: number;
  color: string | null;
  category: string | null;
  archived: boolean;
  linkedFitnessActivityType: string | null;
  reminderStartMinute: number | null;
  reminderEndMinute: number | null;
  reminderDaysOfWeek: number[];
  createdAt: string;
  updatedAt: string;
}

export interface SyncHabitRecord {
  id: string;
  habitId: string;
  date: string;
  value: number;
  status: HabitRecordStatus;
  autoCompleted: boolean;
  fitnessEntryId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SyncSnapshot {
  tasks: SyncTaskRecord[];
  schedules: SyncScheduleRecord[];
  pomodoroSessions: SyncPomodoroRecord[];
  fitnessEntries: SyncFitnessRecord[];
  dailyStepCounts: SyncStepCountRecord[];
  dailyFloorsClimbed: SyncFloorsClimbedRecord[];
  blockListEntries: SyncBlockListRecord[];
  habits: SyncHabit[];
  habitRecords: SyncHabitRecord[];
  syncedAt: string;
}
