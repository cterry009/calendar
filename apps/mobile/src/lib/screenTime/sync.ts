import { syncBatch } from '../sync/api';
import type { AppUsageRecord } from './api';

// Task 8.3: caps match the server's own limits (DailyScreenTimeSyncChangeDto.topApps,
// @ArrayMaxSize(10)) -- this is a display snapshot, not a full per-app ledger, so sending more
// than the dashboard could ever show would just be wasted payload.
const TOP_APPS_COUNT = 10;

export interface DailyScreenTimeUpsert {
  date: string;
  totalMinutes: number;
  topApps: { packageName: string; minutes: number }[];
  updatedAt: string;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function buildDailyScreenTimeUpsert(todayUsage: AppUsageRecord[]): DailyScreenTimeUpsert {
  const totalMs = todayUsage.reduce((sum, entry) => sum + entry.totalTimeMs, 0);
  return {
    date: startOfToday().toISOString(),
    totalMinutes: Math.round(totalMs / 60_000),
    topApps: todayUsage.slice(0, TOP_APPS_COUNT).map((entry) => ({
      packageName: entry.packageName,
      minutes: Math.round(entry.totalTimeMs / 60_000),
    })),
    updatedAt: new Date().toISOString(),
  };
}

// One row per day (server-side upsert keyed on userId+date, see sync.service.ts's
// applyDailyScreenTimeChange) -- pushing an empty-usage snapshot isn't worth a request, so this
// no-ops until there's at least something to report.
export async function syncDailyScreenTime(todayUsage: AppUsageRecord[]): Promise<void> {
  if (todayUsage.length === 0) return;
  await syncBatch({ dailyScreenTime: [buildDailyScreenTimeUpsert(todayUsage)] });
}
