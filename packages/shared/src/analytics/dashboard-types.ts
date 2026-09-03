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

export interface DashboardSnapshot {
  tasks: DashboardTaskInput[];
  pomodoroSessions: DashboardPomodoroInput[];
  fitnessEntries: DashboardFitnessInput[];
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
}
