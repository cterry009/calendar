import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, apiFetch } from '../lib/api';
import type { SyncSnapshot } from '../lib/calendar/types';
import {
  buildCompleteTaskPayload,
  buildCreateTaskPayload,
  buildDeleteTaskPayload,
  buildUpdateTaskPayload,
  syncTaskBatch,
} from '../lib/tasks/sync';
import type { SyncTaskRecord, TaskDifficultyFilter, TaskFormValues } from '../lib/tasks/types';

interface UseTasksResult {
  tasks: SyncTaskRecord[];
  filteredTasks: SyncTaskRecord[];
  difficultyFilter: TaskDifficultyFilter;
  setDifficultyFilter: (filter: TaskDifficultyFilter) => void;
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  syncedAt: string | null;
  refetch: () => Promise<void>;
  createTask: (values: TaskFormValues) => Promise<void>;
  updateTask: (taskId: string, values: TaskFormValues) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  completeTask: (task: SyncTaskRecord, actualMinutes: number) => Promise<void>;
}

function sortTasks(items: SyncTaskRecord[]) {
  return [...items].sort((a, b) => {
    const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;

    if (aTime !== bTime) {
      return aTime - bTime;
    }

    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function useTasks(): UseTasksResult {
  const [tasks, setTasks] = useState<SyncTaskRecord[]>([]);
  const [difficultyFilter, setDifficultyFilter] = useState<TaskDifficultyFilter>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiFetch<SyncSnapshot>('/sync/pull');
      setTasks(sortTasks(data.tasks as SyncTaskRecord[]));
      setSyncedAt(data.syncedAt);
    } catch (errorValue) {
      if (errorValue instanceof ApiError) {
        setError(errorValue.message);
      } else {
        setError('No se pudieron cargar las tareas.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const executeMutation = useCallback(
    async (changes: Parameters<typeof syncTaskBatch>[0]) => {
      setIsMutating(true);
      setError(null);

      try {
        await syncTaskBatch(changes);
        await refetch();
      } catch (errorValue) {
        if (errorValue instanceof ApiError) {
          setError(errorValue.message);
        } else {
          setError('No se pudo sincronizar el cambio de tarea.');
        }
        throw errorValue;
      } finally {
        setIsMutating(false);
      }
    },
    [refetch],
  );

  const createTask = useCallback(
    async (values: TaskFormValues) => {
      await executeMutation([buildCreateTaskPayload(values)]);
    },
    [executeMutation],
  );

  const updateTask = useCallback(
    async (taskId: string, values: TaskFormValues) => {
      await executeMutation([buildUpdateTaskPayload(taskId, values)]);
    },
    [executeMutation],
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      await executeMutation([buildDeleteTaskPayload(taskId)]);
    },
    [executeMutation],
  );

  const completeTask = useCallback(
    async (task: SyncTaskRecord, actualMinutes: number) => {
      await executeMutation([buildCompleteTaskPayload(task, actualMinutes)]);
    },
    [executeMutation],
  );

  const filteredTasks = useMemo(
    () =>
      difficultyFilter === 'ALL'
        ? tasks
        : tasks.filter((task) => task.difficulty === difficultyFilter),
    [difficultyFilter, tasks],
  );

  return {
    tasks,
    filteredTasks,
    difficultyFilter,
    setDifficultyFilter,
    isLoading,
    isMutating,
    error,
    syncedAt,
    refetch,
    createTask,
    updateTask,
    deleteTask,
    completeTask,
  };
}
