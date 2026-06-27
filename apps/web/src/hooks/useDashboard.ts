import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../lib/api';
import { useSync } from '../context/SyncContext';
import { buildDashboardMetrics } from '../lib/analytics/aggregate';
import { seedDemoData } from '../lib/analytics/seed-demo';
import type { DashboardMetrics } from '../lib/analytics/types';
import { useSyncRefetch } from './useSyncRefetch';

interface UseDashboardResult {
  metrics: DashboardMetrics | null;
  isLoading: boolean;
  isSeeding: boolean;
  error: string | null;
  syncedAt: string | null;
  refetch: () => Promise<void>;
  seedDemo: () => Promise<void>;
}

export function useDashboard(): UseDashboardResult {
  const { pullSnapshot } = useSync();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const snapshot = await pullSnapshot();
      const nextMetrics = buildDashboardMetrics({
        tasks: snapshot.tasks,
        pomodoroSessions: snapshot.pomodoroSessions,
        fitnessEntries: snapshot.fitnessEntries,
      });
      setMetrics(nextMetrics);
      setSyncedAt(snapshot.syncedAt);
    } catch (errorValue) {
      if (errorValue instanceof ApiError) {
        setError(errorValue.message);
      } else if (errorValue instanceof Error) {
        setError(errorValue.message);
      } else {
        setError('No se pudo cargar el dashboard de productividad.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [pullSnapshot]);

  useSyncRefetch('tasks', refetch);
  useSyncRefetch('pomodoroSessions', refetch);
  useSyncRefetch('fitnessEntries', refetch);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const seedDemo = useCallback(async () => {
    setIsSeeding(true);
    setError(null);

    try {
      await seedDemoData();
      await refetch();
    } catch (errorValue) {
      if (errorValue instanceof ApiError) {
        setError(errorValue.message);
      } else {
        setError('No se pudieron generar datos de ejemplo.');
      }
      throw errorValue;
    } finally {
      setIsSeeding(false);
    }
  }, [refetch]);

  return useMemo(
    () => ({
      metrics,
      isLoading,
      isSeeding,
      error,
      syncedAt,
      refetch,
      seedDemo,
    }),
    [error, isLoading, isSeeding, metrics, refetch, seedDemo, syncedAt],
  );
}
