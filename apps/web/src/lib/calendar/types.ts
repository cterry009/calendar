import type {
  TaskDifficulty,
  TaskPriority,
  TaskStatus,
  DetoxPlan,
  SerotoninSession,
  HabitType,
  HabitRecordStatus,
} from '@calendar/shared';

export type CalendarViewMode = 'day' | 'week' | 'month';

export type CalendarEventType = 'task' | 'work' | 'rest' | 'pomodoro' | 'fitness';

export interface SyncTask {
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

export interface SyncSchedule {
  id: string;
  kind: 'WORK' | 'REST';
  daysOfWeek: number[];
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

export interface SyncPomodoroSession {
  id: string;
  startedAt: string | null;
  endedAt: string | null;
  focusDurationMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  cyclesBeforeLongBreak: number;
  state: 'IDLE' | 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';
  active: boolean;
  interrupted: boolean;
  completedCycles: number;
  taskId: string | null;
}

export interface SyncFitnessEntry {
  id: string;
  activityType: string;
  durationMinutes: number;
  intensity: 'LOW' | 'MEDIUM' | 'HIGH';
  notes: string | null;
  loggedAt: string;
  source: 'MANUAL' | 'HEALTH_CONNECT' | 'HEALTHKIT' | 'CSV_IMPORT';
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SyncDetoxPlanRecord {
  id: string;
  planData: DetoxPlan;
  updatedAt: string;
  createdAt: string;
}

export interface StoredSerotoninDay {
  date: string;
  session: SerotoninSession;
}

export interface SyncSerotoninSessionRecord {
  id: string;
  sessionData: StoredSerotoninDay;
  updatedAt: string;
  createdAt: string;
}

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
  // Task 11.5 (mobile confirmation-notification work): optional reminder window. Nullable/no
  // backfill needed -- an existing web-created habit simply has no reminder until one is set from
  // either platform.
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

export interface SyncJournalEntry {
  id: string;
  habitId: string;
  recordId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncSnapshot {
  tasks: SyncTask[];
  schedules: SyncSchedule[];
  pomodoroSessions: SyncPomodoroSession[];
  blockListEntries: unknown[];
  focusTriggers: unknown[];
  fitnessEntries: SyncFitnessEntry[];
  detoxPlan: SyncDetoxPlanRecord | null;
  serotoninSession: SyncSerotoninSessionRecord | null;
  habits: SyncHabit[];
  habitRecords: SyncHabitRecord[];
  journalEntries: SyncJournalEntry[];
  syncedAt: string;
}

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  title: string;
  start: Date;
  end: Date;
  taskId?: string;
  meta?: {
    estimatedMinutes?: number;
    estimatedPomodoros?: number | null;
    createdAt?: string;
    state?: SyncPomodoroSession['state'];
    kind?: SyncSchedule['kind'];
    durationMinutes?: number;
    intensity?: SyncFitnessEntry['intensity'];
    pomodoroMin?: number | null;
    shortBreakMin?: number | null;
    longBreakMin?: number | null;
    pomodorosPerChunk?: number | null;
    chunks?: number | null;
  };
}

export interface WeekDaySummary {
  date: Date;
  taskCount: number;
  totalEstimatedMinutes: number;
}

export type CalendarDensity = 'none' | 'low' | 'medium' | 'high';

export interface MonthDaySummary {
  date: Date;
  inCurrentMonth: boolean;
  taskCount: number;
  pomodoroCount: number;
  density: CalendarDensity;
}
