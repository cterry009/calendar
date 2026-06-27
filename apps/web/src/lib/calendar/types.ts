import type { TaskDifficulty, TaskPriority, TaskStatus, DetoxPlan } from '@calendar/shared';

export type CalendarViewMode = 'day' | 'week' | 'month';

export type CalendarEventType = 'task' | 'work' | 'rest' | 'pomodoro' | 'fitness';

export interface SyncTask {
  id: string;
  clientId: string | null;
  title: string;
  description: string | null;
  scheduledAt: string | null;
  estimatedMinutes: number;
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
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  label: string | null;
  enabled: boolean;
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

export interface SyncSnapshot {
  tasks: SyncTask[];
  schedules: SyncSchedule[];
  pomodoroSessions: SyncPomodoroSession[];
  blockListEntries: unknown[];
  fitnessEntries: SyncFitnessEntry[];
  detoxPlan: SyncDetoxPlanRecord | null;
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
    state?: SyncPomodoroSession['state'];
    kind?: SyncSchedule['kind'];
    durationMinutes?: number;
    intensity?: SyncFitnessEntry['intensity'];
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

