import { useCallback, useEffect, useState } from 'react';
import { useSync } from '../context/SyncContext';
import { ApiError } from '../lib/auth/api';
import { buildCompleteTaskPayload, pullSnapshot, syncTaskBatch } from '../lib/calendar/api';
import type { SyncScheduleRecord, SyncTaskRecord } from '../lib/calendar/types';
import type { SyncPomodoroRecord } from '../lib/pomodoro/types';

interface UseCalendarDataResult {
  tasks: SyncTaskRecord[];
  schedules: SyncScheduleRecord[];
  pomodoroSessions: SyncPomodoroRecord[];
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  completeTask: (task: SyncTaskRecord) => Promise<void>;
}

function sortTasks(items: SyncTaskRecord[]) {
  return [...items].sort((a, b) => {
    const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });
}

// No offline cache and no WebSocket live-updates yet (task 6.3) -- pulls fresh from the server
// on mount and after each mutation, same as apps/web's useTasks/useSchedules but without the
// IndexedDB-backed sync client those wrap.
export function useCalendarData(): UseCalendarDataResult {
  const { registerRefetch } = useSync();
  const [tasks, setTasks] = useState<SyncTaskRecord[]>([]);
  const [schedules, setSchedules] = useState<SyncScheduleRecord[]>([]);
  const [pomodoroSessions, setPomodoroSessions] = useState<SyncPomodoroRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const snapshot = await pullSnapshot();
      setTasks(sortTasks(snapshot.tasks));
      setSchedules(snapshot.schedules);
      setPomodoroSessions(snapshot.pomodoroSessions);
    } catch (errorValue) {
      setError(errorValue instanceof ApiError ? errorValue.message : 'No se pudo cargar el calendario.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => registerRefetch(refetch), [registerRefetch, refetch]);

  const completeTask = useCallback(
    async (task: SyncTaskRecord) => {
      setIsMutating(true);
      setError(null);

      try {
        await syncTaskBatch([buildCompleteTaskPayload(task, task.estimatedMinutes)]);
        await refetch();
      } catch (errorValue) {
        setError(errorValue instanceof ApiError ? errorValue.message : 'No se pudo completar la tarea.');
        throw errorValue;
      } finally {
        setIsMutating(false);
      }
    },
    [refetch],
  );

  return { tasks, schedules, pomodoroSessions, isLoading, isMutating, error, refetch, completeTask };
}
