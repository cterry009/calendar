import { useCallback, useEffect, useState } from 'react';
import { useSync } from '../context/SyncContext';
import { ApiError } from '../lib/auth/api';
import {
  buildCreateBlockListPayload,
  buildDeleteBlockListPayload,
  syncBlockListBatch,
} from '../lib/blocklist/sync';
import type { BlockListFormValues, SyncBlockListRecord } from '../lib/blocklist/types';
import { pullSnapshot } from '../lib/sync/api';

interface UseBlockListResult {
  entries: SyncBlockListRecord[];
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createEntry: (values: BlockListFormValues) => Promise<void>;
  deleteEntry: (entryId: string) => Promise<void>;
}

function sortByLabel(items: SyncBlockListRecord[]) {
  return [...items].sort((a, b) => a.label.localeCompare(b.label));
}

// Mirrors apps/web/src/hooks/useBlockList.ts, trimmed to what task 6.5's picker screen needs
// (create + delete, no edit form -- toggling an installed app in/out of the list is the only
// mutation this screen performs; editing an existing entry's fields is left for a later pass,
// same "compact first slice" scope every other mobile hook in this port has used).
export function useBlockList(): UseBlockListResult {
  const { registerRefetch } = useSync();
  const [entries, setEntries] = useState<SyncBlockListRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const snapshot = await pullSnapshot();
      setEntries(sortByLabel(snapshot.blockListEntries));
    } catch (errorValue) {
      setError(errorValue instanceof ApiError ? errorValue.message : 'No se pudo cargar la lista de bloqueo.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => registerRefetch(refetch), [registerRefetch, refetch]);

  const executeMutation = useCallback(
    async (changes: Parameters<typeof syncBlockListBatch>[0]) => {
      setIsMutating(true);
      setError(null);

      try {
        await syncBlockListBatch(changes);
        await refetch();
      } catch (errorValue) {
        setError(errorValue instanceof ApiError ? errorValue.message : 'No se pudo sincronizar la lista de bloqueo.');
        throw errorValue;
      } finally {
        setIsMutating(false);
      }
    },
    [refetch],
  );

  const createEntry = useCallback(
    async (values: BlockListFormValues) => {
      await executeMutation([buildCreateBlockListPayload(values)]);
    },
    [executeMutation],
  );

  const deleteEntry = useCallback(
    async (entryId: string) => {
      await executeMutation([buildDeleteBlockListPayload(entryId)]);
    },
    [executeMutation],
  );

  return { entries, isLoading, isMutating, error, refetch, createEntry, deleteEntry };
}
