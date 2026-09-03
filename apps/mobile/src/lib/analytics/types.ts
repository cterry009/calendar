// Task 8.1: moved to @calendar/shared (packages/shared/src/analytics/dashboard-types.ts) --
// this used to be a hand-duplicated copy of apps/web's own types.ts. Re-exported here so existing
// imports from './types' across this app keep working unchanged.
export type {
  DashboardWeekMetric,
  DifficultyCompletionMetric,
  FocusByDayPoint,
  EstimatedVsActualMetric,
  DashboardMetrics,
  DashboardSnapshot,
} from '@calendar/shared';
