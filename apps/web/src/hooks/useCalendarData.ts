import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetch } from '../lib/api';
import type { SyncSnapshot } from '../lib/calendar/types';

interface UseCalendarDataResult {
  tasks: SyncSnapshot['tasks'];
  schedules: SyncSnapshot['schedules'];
  pomodoroSessions: SyncSnapshot['pomodoroSessions'];
  blockListEntries: SyncSnapshot['blockListEntries'];
  fitnessEntries: SyncSnapshot['fitnessEntries'];
  syncedAt: string | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const EMPTY_SNAPSHOT: Omit<SyncSnapshot, 'syncedAt'> = {
  tasks: [],
  schedules: [],
  pomodoroSessions: [],
  blockListEntries: [],
  fitnessEntries: [],
};

export function useCalendarData(): UseCalendarDataResult {
  const [snapshot, setSnapshot] = useState<Omit<SyncSnapshot, 'syncedAt'>>(EMPTY_SNAPSHOT);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiFetch<SyncSnapshot>('/sync/pull');
      setSnapshot({
        tasks: data.tasks,
        schedules: data.schedules,
        pomodoroSessions: data.pomodoroSessions,
        blockListEntries: data.blockListEntries,
        fitnessEntries: data.fitnessEntries,
      });
      setSyncedAt(data.syncedAt);
    } catch (errorValue) {
      if (errorValue instanceof ApiError) {
        setError(errorValue.message);
      } else {
        setError('No se pudieron cargar los datos del calendario.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    ...snapshot,
    syncedAt,
    isLoading,
    error,
    refetch,
  };
}
