import type { SyncFitnessRecord } from './types';

export interface ActivityBreakdownItem {
  activityType: string;
  totalMinutes: number;
  sessionCount: number;
}

export interface DailyFitnessSummary {
  date: Date;
  totalMinutes: number;
  sessionCount: number;
  activityBreakdown: ActivityBreakdownItem[];
}

export interface WeeklyFitnessSummary {
  weekStart: Date;
  weekEnd: Date;
  totalMinutes: number;
  sessionCount: number;
  activityBreakdown: ActivityBreakdownItem[];
  daily: DailyFitnessSummary[];
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getStartOfWeek(date: Date): Date {
  const day = date.getDay();
  const diffFromMonday = (day + 6) % 7;
  return startOfDay(addDays(date, -diffFromMonday));
}

function buildActivityBreakdown(entries: SyncFitnessRecord[]): ActivityBreakdownItem[] {
  const byActivity = new Map<string, ActivityBreakdownItem>();

  for (const entry of entries) {
    const current = byActivity.get(entry.activityType);
    if (current) {
      current.totalMinutes += entry.durationMinutes;
      current.sessionCount += 1;
    } else {
      byActivity.set(entry.activityType, {
        activityType: entry.activityType,
        totalMinutes: entry.durationMinutes,
        sessionCount: 1,
      });
    }
  }

  return [...byActivity.values()].sort((a, b) => {
    if (b.totalMinutes !== a.totalMinutes) return b.totalMinutes - a.totalMinutes;
    return a.activityType.localeCompare(b.activityType, 'es-ES');
  });
}

export function buildDailySummary(entries: SyncFitnessRecord[], referenceDate: Date): DailyFitnessSummary {
  const dayStart = startOfDay(referenceDate);
  const dayEntries = entries.filter((entry) => isSameDay(new Date(entry.loggedAt), dayStart));

  return {
    date: dayStart,
    totalMinutes: dayEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0),
    sessionCount: dayEntries.length,
    activityBreakdown: buildActivityBreakdown(dayEntries),
  };
}

export function buildWeeklySummary(
  entries: SyncFitnessRecord[],
  referenceDate: Date,
): WeeklyFitnessSummary {
  const weekStart = getStartOfWeek(referenceDate);
  const weekEnd = addDays(weekStart, 6);

  const weeklyEntries = entries.filter((entry) => {
    const loggedAt = new Date(entry.loggedAt);
    return loggedAt >= weekStart && loggedAt < addDays(weekEnd, 1);
  });

  const daily = Array.from({ length: 7 }, (_, index) =>
    buildDailySummary(weeklyEntries, addDays(weekStart, index)),
  );

  return {
    weekStart,
    weekEnd,
    totalMinutes: weeklyEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0),
    sessionCount: weeklyEntries.length,
    activityBreakdown: buildActivityBreakdown(weeklyEntries),
    daily,
  };
}
