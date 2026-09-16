import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useState } from 'react';
import { useSync } from '../context/SyncContext';
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

export function useFitness(): UseFitnessResult {
  const { registerRefetch } = useSync();
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

  useEffect(() => registerRefetch(refetch), [registerRefetch, refetch]);

  // Same fix as useHabits.ts's checkIn / useCalendarData.ts's completeTask: syncFitnessBatch()
  // never rejects when offline (or when an online request fails) -- it queues the change and
  // resolves successfully -- so a plain refetch() afterwards would silently revert to the stale
  // pre-change list. Here the mutation only ever adds/removes a whole entry (no in-place record to
  // diff against, and a create has no server id yet to match on), so instead of refetch()'s
  // self-correct pattern this checks syncFitnessBatch's own `queued` flag and, when true, patches
  // `entries` directly instead of trusting the refetch at all.
  const executeMutation = useCallback(
    async (changes: Parameters<typeof syncFitnessBatch>[0], applyOptimistically: (current: SyncFitnessRecord[]) => SyncFitnessRecord[]) => {
      setIsMutating(true);
      setError(null);

      try {
        const response = await syncFitnessBatch(changes);
        if (response.queued) {
          setEntries((current) => sortByLoggedAtDesc(applyOptimistically(current)));
        } else {
          await refetch();
        }
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
      const nowIso = new Date().toISOString();
      const optimisticEntry: SyncFitnessRecord = {
        id: `pending-${Crypto.randomUUID()}`,
        activityType: values.activityType.trim(),
        durationMinutes: values.durationMinutes,
        intensity: values.intensity,
        notes: values.notes?.trim() || null,
        loggedAt: nowIso,
        source: 'MANUAL',
        externalId: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await executeMutation([buildCreateFitnessPayload(values)], (current) => [...current, optimisticEntry]);
    },
    [executeMutation],
  );

  const deleteEntry = useCallback(
    async (entryId: string) => {
      await executeMutation([buildDeleteFitnessPayload(entryId)], (current) =>
        current.filter((entry) => entry.id !== entryId),
      );
    },
    [executeMutation],
  );

  return { entries, isLoading, isMutating, error, refetch, createEntry, deleteEntry };
}
