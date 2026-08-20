import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../lib/auth/api';
import { buildDashboardMetrics } from '../lib/analytics/aggregate';
import type { DashboardMetrics } from '../lib/analytics/types';
import { pullSnapshot } from '../lib/sync/api';

interface UseDashboardResult {
  metrics: DashboardMetrics | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDashboard(): UseDashboardResult {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const snapshot = await pullSnapshot();
      setMetrics(buildDashboardMetrics(snapshot));
    } catch (errorValue) {
      setError(errorValue instanceof ApiError ? errorValue.message : 'No se pudo cargar el dashboard.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { metrics, isLoading, error, refetch };
}
