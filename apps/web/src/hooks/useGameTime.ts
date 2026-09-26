import { useCallback, useEffect, useState } from 'react';
import { useSync } from '../context/SyncContext';
import type { SyncTopGameUsage } from '../lib/calendar/types';
import { useSyncRefetch } from './useSyncRefetch';

interface UseGameTimeResult {
  todayUsage: SyncTopGameUsage[];
  isLoading: boolean;
  refetch: () => Promise<void>;
}

// Matches packages/shared/src/analytics/dashboard.ts's own toDateKey/computeGameTime exactly (a
// UTC-ISO date slice, not a local Y-M-D) so "today" here agrees with what the dashboard panel
// calls "today" for the same account.
function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// Desktop counterpart of apps/mobile's useScreenTime() -- a lightweight read of just today's
// per-game minutes (already sorted descending, see lib/gameTime/sync.ts's
// buildDailyGameTimeUpsert), for the block-list "Sugerencias de bloqueo" panel. Deliberately
// reads the raw synced snapshot rather than going through buildDashboardMetrics/useDashboard --
// that aggregator also computes a 14-day trend this panel doesn't need, and duplicates a pull.
export function useGameTime(): UseGameTimeResult {
  const { pullSnapshot } = useSync();
  const [todayUsage, setTodayUsage] = useState<SyncTopGameUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const snapshot = await pullSnapshot();
      const todayKey = todayDateKey();
      const todayEntry = (snapshot.dailyGameTime ?? []).find((entry) => entry.date.slice(0, 10) === todayKey);
      setTodayUsage(todayEntry?.topGames ?? []);
    } finally {
      setIsLoading(false);
    }
  }, [pullSnapshot]);

  useSyncRefetch('dailyGameTime', refetch);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { todayUsage, isLoading, refetch };
}
