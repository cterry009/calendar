import type { TaskDifficulty } from '../schemas/enums.js';
import type { EstimationAccuracyReport } from './estimation-accuracy.js';
import type { FitnessCorrelationReport } from './fitness-correlation.js';

// Task 8.1: the minimal shape buildDashboardMetrics/buildSuggestionInput actually read off a
// task/pomodoro-session/fitness-entry -- deliberately NOT importing either app's own SyncSnapshot
// (apps/web's and apps/mobile's sync types are hand-duplicated per platform by this codebase's own
// established convention, see tasks.md 8.5/11.5's reasoning). A real SyncTaskRecord etc already has
// every field below and more, so it's structurally assignable here with no adapter needed at either
// call site -- this is only the subset the aggregation logic depends on.
export interface DashboardTaskInput {
  status: string;
  completedAt: string | null;
  difficulty: TaskDifficulty;
  estimatedMinutes: number;
  actualMinutes: number | null;
}

export interface DashboardPomodoroInput {
  interrupted: boolean;
  startedAt: string | null;
  endedAt: string | null;
  focusDurationMin: number;
  completedCycles?: number;
  shortBreakMin?: number;
}

export interface DashboardFitnessInput {
  loggedAt: string;
  durationMinutes: number;
}

// Task 8.4: the cross-platform metrics added below all read from these -- optional (not part of
// every existing caller/test) so a snapshot that omits them just yields an honest hasData:false
// sub-metric instead of a type error. Same minimal-structural-type approach as the fields above.
export interface DashboardHabitInput {
  archived: boolean;
}

export interface DashboardHabitRecordInput {
  date: string;
  status: string;
}

export interface DashboardStepCountInput {
  date: string;
  steps: number;
}

export interface DashboardFloorsClimbedInput {
  date: string;
  floors: number;
}

export interface DashboardBlockEventInput {
  occurredAt: string;
  trigger: string;
}

export interface DashboardTopAppUsage {
  packageName: string;
  minutes: number;
}

export interface DashboardScreenTimeInput {
  date: string;
  totalMinutes: number;
  topApps: DashboardTopAppUsage[];
}

export interface DashboardSnapshot {
  tasks: DashboardTaskInput[];
  pomodoroSessions: DashboardPomodoroInput[];
  fitnessEntries: DashboardFitnessInput[];
  habits?: DashboardHabitInput[];
  habitRecords?: DashboardHabitRecordInput[];
  dailyStepCounts?: DashboardStepCountInput[];
  dailyFloorsClimbed?: DashboardFloorsClimbedInput[];
  blockEvents?: DashboardBlockEventInput[];
  dailyScreenTime?: DashboardScreenTimeInput[];
}

export interface DashboardWeekMetric {
  current: number;
  previous: number;
  delta: number;
  deltaPct: number;
}

export interface DifficultyCompletionMetric {
  difficulty: TaskDifficulty;
  completed: number;
  total: number;
  completionRate: number;
}

export interface FocusByDayPoint {
  date: string;
  label: string;
  focusHours: number;
}

export interface EstimatedVsActualMetric {
  estimatedMinutes: number;
  actualMinutes: number;
  varianceMinutes: number;
  variancePct: number;
}

// Task 8.4. A single day/value point, shared shape for every new trend chart below (steps,
// floors, block-events) -- FocusByDayPoint already established this exact shape for focus hours,
// this just generalizes the field name since "focusHours" doesn't fit steps/floors/block counts.
export interface DashboardTrendPoint {
  date: string;
  label: string;
  value: number;
}

export interface HabitCompletionMetric {
  hasData: boolean;
  activeHabitCount: number;
  completedToday: number;
  /** Consecutive days (grace-forgiving, see computePomodoroStreak) with at least one habit marked DONE. */
  currentStreak: number;
}

export interface DeviceSensorMetric {
  hasData: boolean;
  todaySteps: number;
  todayFloors: number;
  stepsByDay: DashboardTrendPoint[];
  floorsByDay: DashboardTrendPoint[];
}

export interface BlockEventMetric {
  hasData: boolean;
  blockedAttempts: DashboardWeekMetric;
  nightUnlocks: DashboardWeekMetric;
  blockedByDay: DashboardTrendPoint[];
}

export interface ScreenTimeMetric {
  hasData: boolean;
  todayMinutes: number;
  weekAverageMinutes: number;
  byDay: DashboardTrendPoint[];
  topAppsToday: DashboardTopAppUsage[];
}

export interface DashboardMetrics {
  hasData: boolean;
  tasksCompleted: DashboardWeekMetric;
  pomodorosCompleted: DashboardWeekMetric;
  focusHours: DashboardWeekMetric;
  focusByDay: FocusByDayPoint[];
  estimatedVsActual: EstimatedVsActualMetric;
  estimationAccuracy: EstimationAccuracyReport;
  completionByDifficulty: DifficultyCompletionMetric[];
  fitnessCorrelation: FitnessCorrelationReport;
  habitCompletion: HabitCompletionMetric;
  deviceSensors: DeviceSensorMetric;
  blockEvents: BlockEventMetric;
  screenTime: ScreenTimeMetric;
}
