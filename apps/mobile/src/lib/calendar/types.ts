import type {
  AttentionProfile,
  AttentionSource,
  HabitRecordStatus,
  HabitType,
  SequenceSegment,
  StudyPlanData,
  TaskDifficulty,
  TaskPriority,
  TaskStatus,
} from '@calendar/shared';
import type { SyncBlockEventRecord } from '../blockEvents/types';
import type { SyncBlockListRecord } from '../blocklist/types';
import type { SyncFitnessRecord } from '../fitness/types';
import type { SyncFloorsClimbedRecord } from '../floors/types';
import type { SyncPomodoroRecord } from '../pomodoro/types';
import type { SyncDailyScreenTimeRecord } from '../screenTime/types';
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
  // Attention rating (docs/planning/normas-de-atencion.md); absent from older servers.
  attentionReentry?: number | null;
  attentionLoad?: number | null;
  attentionProfile?: AttentionProfile | null;
  attentionSource?: AttentionSource | null;
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
  /** Horario 2026-10-19: plan category and pomodoro sequence; absent on older servers. */
  category?: string | null;
  sequence?: SequenceSegment[] | null;
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

/** A schedule block marked done on a day (server ScheduleCompletion); `date` is that day's UTC midnight. */
export interface SyncScheduleCompletion {
  id: string;
  scheduleId: string;
  date: string;
  /** DONE, or SKIPPED: "no puedo hacer este bloque" that day. Absent on older servers = DONE. */
  status?: 'DONE' | 'SKIPPED';
  reason?: string | null;
  clientId: string | null;
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
  blockEvents: SyncBlockEventRecord[];
  dailyScreenTime: SyncDailyScreenTimeRecord[];
  habits: SyncHabit[];
  habitRecords: SyncHabitRecord[];
  // Optional: snapshots cached before this existed don't have it.
  scheduleCompletions?: SyncScheduleCompletion[];
  /** Horario 2026-10-19; absent on older servers / cached snapshots. */
  scheduleExceptions?: SyncScheduleException[];
  studyPlan?: { id: string; planData: StudyPlanData; updatedAt: string } | null;
  syncedAt: string;
}

/** A one-off change to one block on one day (server ScheduleException); `date` is that day's UTC midnight. */
export interface SyncScheduleException {
  id: string;
  scheduleId: string;
  date: string;
  category: string | null;
  label: string | null;
  startMinute: number | null;
  endMinute: number | null;
  clientId: string | null;
  updatedAt: string;
}
