import type { EstimationAccuracyReport, FitnessCorrelationReport, TaskDifficulty } from '@calendar/shared';
import type { SyncSnapshot } from '../calendar/types';

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

export type DashboardSnapshot = Pick<SyncSnapshot, 'tasks' | 'pomodoroSessions' | 'fitnessEntries'>;
