import type {
  CommitmentView,
  HabitKind,
  AttentionProfile,
  ExerciseAttempt,
  TaskDifficulty,
  TaskPriority,
  TaskStatus,
  DetoxPlan,
  SerotoninSession,
  HabitType,
  HabitRecordStatus,
  SequenceSegment,
  StudyPlanData,
  TimedSegment,
} from '@calendar/shared';

export type CalendarViewMode = 'day' | 'week' | 'month';

export type CalendarEventType = 'task' | 'work' | 'rest' | 'pomodoro' | 'fitness' | 'habit';

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
  // Attention rating (docs/planning/normas-de-atencion.md); absent from older snapshots.
  attentionProfile?: AttentionProfile | null;
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
  category?: string | null;
  sequence?: SequenceSegment[] | null;
  /** The morning window (2026-10-22): blocks started on demand in it; null for a fixed block. */
  flexibleBlocks?: number | null;
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
  scheduleId?: string | null;
  blockStartAt?: string | null;
  cutCount?: number;
  /** Flexible morning block (2026-10-22): its real focus minutes count it as done (60+). */
  flexible?: boolean;
  focusMinutes?: number;
  createdAt?: string;
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
  /** weekend-mode; absent on cached snapshots (a habit). */
  kind?: HabitKind;
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

// Task 8.4/8.5. Android-sourced (steps/floors from device sensors, screen time from
// UsageStatsManager, block events from the AccessibilityService -- see tasks.md 8.2/8.3), but the
// server already returns them for any account via the shared /sync/pull, empty arrays included --
// this was never typed on the web side before now simply because nothing here read it yet.
export interface SyncDailyStepCount {
  id: string;
  date: string;
  steps: number;
}

export interface SyncDailyFloorsClimbed {
  id: string;
  date: string;
  floors: number;
}

export interface SyncBlockEvent {
  id: string;
  identifier: string | null;
  scope: 'FOCUS' | 'NIGHT';
  trigger: 'BLOCKED_OPEN_ATTEMPT' | 'NIGHT_UNLOCK' | 'MORNING_FIRST_USE' | 'MORNING_EXERCISE_YES' | 'MORNING_EXERCISE_NO';
  occurredAt: string;
}

export interface SyncTopAppUsage {
  packageName: string;
  minutes: number;
}

export interface SyncDailyScreenTime {
  id: string;
  date: string;
  totalMinutes: number;
  topApps: SyncTopAppUsage[];
}

export interface SyncTopGameUsage {
  key: string;
  label: string;
  minutes: number;
  source: string;
}

export interface SyncDailyGameTime {
  id: string;
  date: string;
  totalMinutes: number;
  topGames: SyncTopGameUsage[];
}

export interface SyncTopDesktopAppUsage {
  key: string;
  label: string;
  minutes: number;
}

export interface SyncDailyDesktopAppTime {
  id: string;
  date: string;
  totalMinutes: number;
  topApps: SyncTopDesktopAppUsage[];
}

/** A schedule block marked done on a day (server ScheduleCompletion). `date` is that day's UTC midnight. */
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
  tasks: SyncTask[];
  schedules: SyncSchedule[];
  pomodoroSessions: SyncPomodoroSession[];
  blockListEntries: unknown[];
  focusTriggers: unknown[];
  fitnessEntries: SyncFitnessEntry[];
  dailyStepCounts: SyncDailyStepCount[];
  dailyFloorsClimbed: SyncDailyFloorsClimbed[];
  blockEvents: SyncBlockEvent[];
  dailyScreenTime: SyncDailyScreenTime[];
  dailyGameTime: SyncDailyGameTime[];
  dailyDesktopAppTime: SyncDailyDesktopAppTime[];
  detoxPlan: SyncDetoxPlanRecord | null;
  serotoninSession: SyncSerotoninSessionRecord | null;
  habits: SyncHabit[];
  habitRecords: SyncHabitRecord[];
  journalEntries: SyncJournalEntry[];
  scheduleCompletions: SyncScheduleCompletion[];
  /** Horario 2026-10-19; absent on older servers / cached snapshots. */
  scheduleExceptions?: SyncScheduleException[];
  studyPlan?: SyncStudyPlanRecord | null;
  /**
   * Every graded exercise, oldest first, without the generated statement and feedback (study game,
   * 2026-10-21). Absent on older servers / cached snapshots: read it with `exerciseAttemptsOf`.
   */
  exerciseAttempts?: ExerciseAttempt[];
  /** The block commitment (weekend-mode), read-only; absent on older servers / cached snapshots. */
  commitment?: CommitmentView | null;
  /** projects-and-claude-bridge (2026-11-09); absent on older servers / cached snapshots. */
  projects?: SyncProject[];
  projectLogEntries?: SyncProjectLogEntry[];
  syncedAt: string;
}

export interface SyncProject {
  id: string;
  clientId: string | null;
  title: string;
  summary: string | null;
  status: 'ACTIVE' | 'PAUSED' | 'BLOCKED' | 'IDEA' | 'DONE';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  area: string | null;
  color: string | null;
  deadline: string | null;
  /** 0-100; null = not estimated. */
  progress: number | null;
  nextSteps: string[];
  blocker: string | null;
  updatedAt: string;
  deletedAt: string | null;
}

export interface SyncProjectLogEntry {
  id: string;
  projectId: string;
  date: string;
  text: string;
  source: 'APP' | 'CLAUDE';
  updatedAt: string;
  deletedAt: string | null;
}

/** A one-off change to one block on one day (server ScheduleException). `date` is that day's UTC midnight. */
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

export interface SyncStudyPlanRecord {
  id: string;
  planData: StudyPlanData;
  updatedAt: string;
  createdAt: string;
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
    habitId?: string;
    /** "antes de las 07:00" or "08:00-09:00" -- how the habit's block was defined. */
    habitWhen?: string;
    /** The habit's own color (hex) -- habits are drawn in it, outlined, to stand apart from tasks. */
    habitColor?: string;
    /** Work/rest schedule this block came from (for marking it done). */
    scheduleId?: string;
    /** Marked done for this day: a ScheduleCompletion for blocks, a DONE HabitRecord for habits. */
    done?: boolean;
    /** Work blocks: marked "no puedo hacer este bloque" that day. */
    skipped?: boolean;
    /** The day's HabitRecord id, so un-marking can delete it. */
    habitRecordId?: string;
    /** Horario 2026-10-19: the block's category that day, its phase description, and its sequence. */
    category?: string | null;
    description?: string | null;
    isException?: boolean;
    segments?: TimedSegment[] | null;
    sequenceWarning?: string | null;
    /** The morning window (2026-10-22): blocks started on demand inside it, no fixed pomodoros. */
    flexibleBlocks?: number | null;
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
