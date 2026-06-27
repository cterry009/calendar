import type {
  EstimationAccuracyReport,
  FitnessCorrelationReport,
  Suggestion,
  TaskDifficulty,
} from '@calendar/shared';
import type { SyncSnapshot } from '../calendar/types';
import type { FitnessSyncChangeDto } from '../fitness/sync';
import type { PomodoroSyncChangeDto } from '../pomodoro/sync';
import type { TaskSyncChangeDto } from '../tasks/sync';

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
  suggestions: Suggestion[];
}

export type DashboardSnapshot = Pick<SyncSnapshot, 'tasks' | 'pomodoroSessions' | 'fitnessEntries'>;

export interface DashboardDemoPayload {
  tasks: TaskSyncChangeDto[];
  pomodoroSessions: PomodoroSyncChangeDto[];
  fitnessEntries: FitnessSyncChangeDto[];
}
