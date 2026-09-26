import { useCallback, useEffect, useState } from 'react';
import { useSync } from '../context/SyncContext';
import type { SyncTopDesktopAppUsage } from '../lib/calendar/types';
import { useSyncRefetch } from './useSyncRefetch';

interface UseDesktopAppTimeResult {
  todayUsage: SyncTopDesktopAppUsage[];
  totalMinutes: number;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

// Same UTC-ISO date slice useGameTime uses, so "today" here agrees with every other panel reading
// the same snapshot.
function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// Reads today's per-app foreground minutes straight off the synced snapshot -- the same
// deliberate shortcut useGameTime takes: buildDashboardMetrics also computes a 14-day trend this
// panel doesn't need, and going through it would duplicate a pull.
export function useDesktopAppTime(): UseDesktopAppTimeResult {
  const { pullSnapshot } = useSync();
  const [todayUsage, setTodayUsage] = useState<SyncTopDesktopAppUsage[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const snapshot = await pullSnapshot();
      const todayKey = todayDateKey();
      const todayEntry = (snapshot.dailyDesktopAppTime ?? []).find(
        (entry) => entry.date.slice(0, 10) === todayKey,
      );
      setTodayUsage(todayEntry?.topApps ?? []);
      setTotalMinutes(todayEntry?.totalMinutes ?? 0);
    } finally {
      setIsLoading(false);
    }
  }, [pullSnapshot]);

  useSyncRefetch('dailyDesktopAppTime', refetch);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { todayUsage, totalMinutes, isLoading, refetch };
}
