import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../lib/auth/api';
import { buildCreateFitnessPayload, buildDeleteFitnessPayload, syncFitnessBatch } from '../lib/fitness/api';
import type { FitnessFormValues, SyncFitnessRecord } from '../lib/fitness/types';
import { pullSnapshot } from '../lib/sync/api';

interface UseFitnessResult {
  entries: SyncFitnessRecord[];
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createEntry: (values: FitnessFormValues) => Promise<void>;
  deleteEntry: (entryId: string) => Promise<void>;
}

function sortByLoggedAtDesc(items: SyncFitnessRecord[]) {
  return [...items].sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
}

// Same no-offline-cache-yet pattern as tasks/schedules/pomodoro (task 6.3 adds that layer).
export function useFitness(): UseFitnessResult {
  const [entries, setEntries] = useState<SyncFitnessRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const snapshot = await pullSnapshot();
      setEntries(sortByLoggedAtDesc(snapshot.fitnessEntries));
    } catch (errorValue) {
      setError(errorValue instanceof ApiError ? errorValue.message : 'No se pudieron cargar los registros de fitness.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const executeMutation = useCallback(
    async (changes: Parameters<typeof syncFitnessBatch>[0]) => {
      setIsMutating(true);
      setError(null);

      try {
        await syncFitnessBatch(changes);
        await refetch();
      } catch (errorValue) {
        setError(errorValue instanceof ApiError ? errorValue.message : 'No se pudo sincronizar el registro de fitness.');
        throw errorValue;
      } finally {
        setIsMutating(false);
      }
    },
    [refetch],
  );

  const createEntry = useCallback(
    async (values: FitnessFormValues) => {
      await executeMutation([buildCreateFitnessPayload(values)]);
    },
    [executeMutation],
  );

  const deleteEntry = useCallback(
    async (entryId: string) => {
      await executeMutation([buildDeleteFitnessPayload(entryId)]);
    },
    [executeMutation],
  );

  return { entries, isLoading, isMutating, error, refetch, createEntry, deleteEntry };
}
