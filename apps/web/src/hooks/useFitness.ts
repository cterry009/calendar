import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, apiFetch } from '../lib/api';
import type { SyncSnapshot } from '../lib/calendar/types';
import {
  buildCreateFitnessPayload,
  buildDeleteFitnessPayload,
  buildUpdateFitnessPayload,
  syncFitnessBatch,
} from '../lib/fitness/sync';
import type { FitnessFormValues, SyncFitnessRecord } from '../lib/fitness/types';

interface UseFitnessResult {
  entries: SyncFitnessRecord[];
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  syncedAt: string | null;
  refetch: () => Promise<void>;
  createEntry: (values: FitnessFormValues) => Promise<void>;
  updateEntry: (entryId: string, values: FitnessFormValues) => Promise<void>;
  deleteEntry: (entryId: string) => Promise<void>;
}

function sortEntries(items: SyncFitnessRecord[]) {
  return [...items].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
}

export function useFitness(): UseFitnessResult {
  const [entries, setEntries] = useState<SyncFitnessRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiFetch<SyncSnapshot>('/sync/pull');
      setEntries(sortEntries(data.fitnessEntries));
      setSyncedAt(data.syncedAt);
    } catch (errorValue) {
      if (errorValue instanceof ApiError) {
        setError(errorValue.message);
      } else {
        setError('No se pudieron cargar los registros de fitness.');
      }
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
        if (errorValue instanceof ApiError) {
          setError(errorValue.message);
        } else {
          setError('No se pudo sincronizar el cambio de fitness.');
        }
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

  const updateEntry = useCallback(
    async (entryId: string, values: FitnessFormValues) => {
      await executeMutation([buildUpdateFitnessPayload(entryId, values)]);
    },
    [executeMutation],
  );

  const deleteEntry = useCallback(
    async (entryId: string) => {
      await executeMutation([buildDeleteFitnessPayload(entryId)]);
    },
    [executeMutation],
  );

  return useMemo(
    () => ({
      entries,
      isLoading,
      isMutating,
      error,
      syncedAt,
      refetch,
      createEntry,
      updateEntry,
      deleteEntry,
    }),
    [createEntry, deleteEntry, entries, error, isLoading, isMutating, refetch, syncedAt, updateEntry],
  );
}
