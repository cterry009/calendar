import { generateSuggestions } from '@calendar/shared';
import { useCallback, useEffect, useState } from 'react';
import { useNotifications } from '../context/NotificationsContext';
import { useSync } from '../context/SyncContext';
import { ApiError } from '../lib/auth/api';
import { buildDashboardMetrics } from '../lib/analytics/aggregate';
import { buildSuggestionInput } from '../lib/analytics/build-suggestion-input';
import type { DashboardMetrics } from '../lib/analytics/types';
import { maybeNotifyTopSuggestion } from '../lib/notifications/suggestionNotifications';
import { pullSnapshot } from '../lib/sync/api';

interface UseDashboardResult {
  metrics: DashboardMetrics | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDashboard(): UseDashboardResult {
  const { registerRefetch } = useSync();
  const { notificationsEnabled } = useNotifications();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const snapshot = await pullSnapshot();
      const dashboardMetrics = buildDashboardMetrics(snapshot);
      setMetrics(dashboardMetrics);

      // Same computation the dashboard cards already show (estimation accuracy, fitness
      // correlation, etc.) fed into the pure @calendar/shared suggestion engine -- see task 6.4.
      // No separate fetch, no background task: this runs whenever the dashboard is opened.
      if (notificationsEnabled) {
        const suggestions = generateSuggestions({
          ...buildSuggestionInput(snapshot),
          estimationByDifficulty: dashboardMetrics.estimationAccuracy.byDifficulty,
        });
        void maybeNotifyTopSuggestion(suggestions);
      }
    } catch (errorValue) {
      setError(errorValue instanceof ApiError ? errorValue.message : 'No se pudo cargar el dashboard.');
    } finally {
      setIsLoading(false);
    }
  }, [notificationsEnabled]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => registerRefetch(refetch), [registerRefetch, refetch]);

  return { metrics, isLoading, error, refetch };
}
