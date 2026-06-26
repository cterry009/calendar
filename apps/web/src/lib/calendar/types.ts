export type CalendarViewMode = 'day' | 'week' | 'month';

export type CalendarEventType = 'task' | 'work' | 'rest' | 'pomodoro';

export interface SyncTask {
  id: string;
  title: string;
  scheduledAt: string | null;
  estimatedMinutes: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
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
  state: 'IDLE' | 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';
  active: boolean;
  taskId: string | null;
}

export interface SyncSnapshot {
  tasks: SyncTask[];
  schedules: SyncSchedule[];
  pomodoroSessions: SyncPomodoroSession[];
  blockListEntries: unknown[];
  fitnessEntries: unknown[];
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
