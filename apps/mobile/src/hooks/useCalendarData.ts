import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSync } from '../context/SyncContext';
import { ApiError } from '../lib/auth/api';
import { buildCompleteTaskPayload, pullSnapshot, syncTaskBatch } from '../lib/calendar/api';
import { skippedBlockKeys } from '../lib/calendar/skips';
import type { SyncScheduleCompletion, SyncScheduleRecord, SyncTaskRecord } from '../lib/calendar/types';
import type { SyncPomodoroRecord } from '../lib/pomodoro/types';

interface UseCalendarDataResult {
  tasks: SyncTaskRecord[];
  schedules: SyncScheduleRecord[];
  pomodoroSessions: SyncPomodoroRecord[];
  scheduleCompletions: SyncScheduleCompletion[];
  /** Blocks marked "no puedo" (blockOccurrenceKey). */
  skipped: Set<string>;
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
  const [scheduleCompletions, setScheduleCompletions] = useState<SyncScheduleCompletion[]>([]);
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
      setScheduleCompletions(snapshot.scheduleCompletions ?? []);
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

  // Same fix as useHabits.ts's checkIn: syncTaskBatch() never rejects when offline (or when an
  // online request fails) -- it queues the change and resolves successfully -- so the refetch()
  // below always runs, but pullSnapshot() falls back to the stale pre-change snapshot in exactly
  // that case. Without correcting for it, tapping "completar" on a task would silently revert to
  // not-completed. Re-apply our own optimistic record on top of whatever refetch() returned: a
  // no-op when the fresh/cached data already reflects it, a real correction when it doesn't.
  const completeTask = useCallback(
    async (task: SyncTaskRecord) => {
      setIsMutating(true);
      setError(null);

      const nowIso = new Date().toISOString();
      const optimisticTask: SyncTaskRecord = {
        ...task,
        status: 'COMPLETED',
        actualMinutes: task.estimatedMinutes,
        completedAt: nowIso,
        updatedAt: nowIso,
      };

      try {
        await syncTaskBatch([buildCompleteTaskPayload(task, task.estimatedMinutes)]);
        await refetch();
        setTasks((current) => {
          const postRefetch = current.find((entry) => entry.id === task.id);
          if (postRefetch?.status === 'COMPLETED') {
            return current; // refetch already reflects our change (the normal online case)
          }
          return sortTasks(
            postRefetch
              ? current.map((entry) => (entry.id === task.id ? optimisticTask : entry))
              : [...current, optimisticTask],
          );
        });
      } catch (errorValue) {
        setError(errorValue instanceof ApiError ? errorValue.message : 'No se pudo completar la tarea.');
        throw errorValue;
      } finally {
        setIsMutating(false);
      }
    },
    [refetch],
  );

  const skipped = useMemo(() => skippedBlockKeys(scheduleCompletions), [scheduleCompletions]);

  return { tasks, schedules, pomodoroSessions, scheduleCompletions, skipped, isLoading, isMutating, error, refetch, completeTask };
}
