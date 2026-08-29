import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { getAppUsage, hasUsageAccess, openUsageAccessSettings, type AppUsageRecord } from '../lib/screenTime/api';

interface UseScreenTimeResult {
  isSupported: boolean;
  // null while the initial permission check hasn't resolved yet.
  hasAccess: boolean | null;
  isLoading: boolean;
  error: string | null;
  // Both sorted descending by totalTimeMs -- "most used" first.
  todayUsage: AppUsageRecord[];
  weekUsage: AppUsageRecord[];
  refresh: () => void;
  requestAccess: () => void;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function startOfToday(): number {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function byUsageDesc(a: AppUsageRecord, b: AppUsageRecord): number {
  return b.totalTimeMs - a.totalTimeMs;
}

// Screen time is inherently per-device (a phone's own foreground-app history isn't meaningful to
// merge with another device's), so this deliberately doesn't sync anywhere -- it's a live read of
// Android's own UsageStatsManager, same "local-only status" shape as the accessibility-service/
// battery-optimization checks on the block-list screen, not a new synced entity.
export function useScreenTime(): UseScreenTimeResult {
  const isSupported = Platform.OS === 'android';
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [todayUsage, setTodayUsage] = useState<AppUsageRecord[]>([]);
  const [weekUsage, setWeekUsage] = useState<AppUsageRecord[]>([]);

  const refresh = useCallback(() => {
    if (!isSupported) {
      setHasAccess(false);
      return;
    }

    const granted = hasUsageAccess();
    setHasAccess(granted);
    if (!granted) return;

    setIsLoading(true);
    setError(null);

    try {
      const now = Date.now();
      setTodayUsage([...getAppUsage(startOfToday(), now)].sort(byUsageDesc));
      setWeekUsage([...getAppUsage(now - WEEK_MS, now)].sort(byUsageDesc));
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : 'No se pudo leer el tiempo de uso.');
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { isSupported, hasAccess, isLoading, error, todayUsage, weekUsage, refresh, requestAccess: openUsageAccessSettings };
}
