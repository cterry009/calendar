// Task 8.1: moved to @calendar/shared (packages/shared/src/analytics/dashboard.ts) -- this used
// to be a byte-for-byte port of apps/web's own copy. Re-exported here so existing imports from
// './aggregate' keep working unchanged.
export { buildDashboardMetrics } from '@calendar/shared';
