import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../lib/api';
import { useSync } from '../context/SyncContext';
import {
  buildCreateSchedulePayload,
  buildDeleteSchedulePayload,
  buildUpdateSchedulePayload,
  syncScheduleBatch,
} from '../lib/schedules/sync';
import type { ScheduleFormValues, SyncScheduleRecord } from '../lib/schedules/types';
import { useSyncRefetch } from './useSyncRefetch';

interface UseSchedulesResult {
  schedules: SyncScheduleRecord[];
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  syncedAt: string | null;
  refetch: () => Promise<void>;
  createSchedule: (values: ScheduleFormValues) => Promise<void>;
  updateSchedule: (scheduleId: string, values: ScheduleFormValues) => Promise<void>;
  deleteSchedule: (scheduleId: string) => Promise<void>;
}

function sortSchedules(items: SyncScheduleRecord[]) {
  return [...items].sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
    if (a.kind !== b.kind) return a.kind === 'WORK' ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}

export function useSchedules(): UseSchedulesResult {
  const { pullSnapshot } = useSync();
  const [schedules, setSchedules] = useState<SyncScheduleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await pullSnapshot();
      setSchedules(sortSchedules(data.schedules as SyncScheduleRecord[]));
      setSyncedAt(data.syncedAt);
    } catch (errorValue) {
      if (errorValue instanceof ApiError) {
        setError(errorValue.message);
      } else if (errorValue instanceof Error) {
        setError(errorValue.message);
      } else {
        setError('No se pudieron cargar los horarios.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [pullSnapshot]);

  useSyncRefetch('schedules', refetch);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const executeMutation = useCallback(
    async (changes: Parameters<typeof syncScheduleBatch>[0]) => {
      setIsMutating(true);
      setError(null);

      try {
        await syncScheduleBatch(changes);
        await refetch();
      } catch (errorValue) {
        if (errorValue instanceof ApiError) {
          setError(errorValue.message);
        } else {
          setError('No se pudo sincronizar el cambio de horario.');
        }
        throw errorValue;
      } finally {
        setIsMutating(false);
      }
    },
    [refetch],
  );

  const createSchedule = useCallback(
    async (values: ScheduleFormValues) => {
      await executeMutation([buildCreateSchedulePayload(values)]);
    },
    [executeMutation],
  );

  const updateSchedule = useCallback(
    async (scheduleId: string, values: ScheduleFormValues) => {
      await executeMutation([buildUpdateSchedulePayload(scheduleId, values)]);
    },
    [executeMutation],
  );

  const deleteSchedule = useCallback(
    async (scheduleId: string) => {
      await executeMutation([buildDeleteSchedulePayload(scheduleId)]);
    },
    [executeMutation],
  );

  return useMemo(
    () => ({
      schedules,
      isLoading,
      isMutating,
      error,
      syncedAt,
      refetch,
      createSchedule,
      updateSchedule,
      deleteSchedule,
    }),
    [createSchedule, deleteSchedule, error, isLoading, isMutating, refetch, schedules, syncedAt, updateSchedule],
  );
}
