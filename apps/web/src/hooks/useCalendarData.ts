import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../lib/api';
import { useSync } from '../context/SyncContext';
import type { SyncSnapshot } from '../lib/calendar/types';
import { useSyncRefetch } from './useSyncRefetch';

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
  detoxPlan: null,
};

export function useCalendarData(): UseCalendarDataResult {
  const { pullSnapshot } = useSync();
  const [snapshot, setSnapshot] = useState<Omit<SyncSnapshot, 'syncedAt'>>(EMPTY_SNAPSHOT);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await pullSnapshot();
      setSnapshot({
        tasks: data.tasks,
        schedules: data.schedules,
        pomodoroSessions: data.pomodoroSessions,
        blockListEntries: data.blockListEntries,
        fitnessEntries: data.fitnessEntries,
        detoxPlan: data.detoxPlan ?? null,
      });
      setSyncedAt(data.syncedAt);
    } catch (errorValue) {
      if (errorValue instanceof ApiError) {
        setError(errorValue.message);
      } else if (errorValue instanceof Error) {
        setError(errorValue.message);
      } else {
        setError('No se pudieron cargar los datos del calendario.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [pullSnapshot]);

  useSyncRefetch('tasks', refetch);
  useSyncRefetch('schedules', refetch);
  useSyncRefetch('pomodoroSessions', refetch);
  useSyncRefetch('fitnessEntries', refetch);
  useSyncRefetch('detoxPlan', refetch);

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
