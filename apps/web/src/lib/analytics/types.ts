// Task 8.1: the dashboard aggregation types (DashboardMetrics/DashboardSnapshot and friends) now
// live in @calendar/shared, re-exported here so existing imports from './types' across this app
// keep working unchanged. `DashboardDemoPayload` stays local -- it's a web-only concept for the
// demo-data seeder (seed-demo.ts), not part of the shared aggregation contract.
export type {
  DashboardWeekMetric,
  DifficultyCompletionMetric,
  FocusByDayPoint,
  EstimatedVsActualMetric,
  DashboardMetrics,
  DashboardSnapshot,
} from '@calendar/shared';

import type { FitnessSyncChangeDto } from '../fitness/sync';
import type { PomodoroSyncChangeDto } from '../pomodoro/sync';
import type { TaskSyncChangeDto } from '../tasks/sync';

export interface DashboardDemoPayload {
  tasks: TaskSyncChangeDto[];
  pomodoroSessions: PomodoroSyncChangeDto[];
  fitnessEntries: FitnessSyncChangeDto[];
}
