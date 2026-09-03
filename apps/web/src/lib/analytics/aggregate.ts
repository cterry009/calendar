// Task 8.1: moved to @calendar/shared (packages/shared/src/analytics/dashboard.ts), re-exported
// here so existing imports from './aggregate' keep working unchanged. Was previously hand-
// duplicated between this file and apps/mobile's own copy -- see tasks.md 8.1.
export { buildDashboardMetrics } from '@calendar/shared';
