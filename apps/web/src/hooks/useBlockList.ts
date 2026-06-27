import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../lib/api';
import { useSync } from '../context/SyncContext';
import {
  buildCreateBlockListPayload,
  buildDeleteBlockListPayload,
  buildUpdateBlockListPayload,
  syncBlockListBatch,
} from '../lib/blocklist/sync';
import type { BlockListFormValues, SyncBlockListRecord } from '../lib/blocklist/types';
import { useSyncRefetch } from './useSyncRefetch';

interface UseBlockListResult {
  entries: SyncBlockListRecord[];
  enabledEntries: SyncBlockListRecord[];
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  syncedAt: string | null;
  refetch: () => Promise<void>;
  createEntry: (values: BlockListFormValues) => Promise<void>;
  updateEntry: (entryId: string, values: BlockListFormValues) => Promise<void>;
  deleteEntry: (entryId: string) => Promise<void>;
}

function sortEntries(items: SyncBlockListRecord[]) {
  return [...items].sort((a, b) => a.label.localeCompare(b.label));
}

export function useBlockList(): UseBlockListResult {
  const { pullSnapshot } = useSync();
  const [entries, setEntries] = useState<SyncBlockListRecord[]>([]);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await pullSnapshot();
      setEntries(sortEntries((data.blockListEntries as SyncBlockListRecord[]) ?? []));
      setSyncedAt(data.syncedAt);
    } catch (errorValue) {
      if (errorValue instanceof ApiError) {
        setError(errorValue.message);
      } else if (errorValue instanceof Error) {
        setError(errorValue.message);
      } else {
        setError('No se pudo cargar la lista de bloqueo.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [pullSnapshot]);

  useSyncRefetch('blockListEntries', refetch);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const executeMutation = useCallback(
    async (changes: Parameters<typeof syncBlockListBatch>[0]) => {
      setIsMutating(true);
      setError(null);

      try {
        await syncBlockListBatch(changes);
        await refetch();
      } catch (errorValue) {
        if (errorValue instanceof ApiError) {
          setError(errorValue.message);
        } else if (errorValue instanceof Error) {
          setError(errorValue.message);
        } else {
          setError('No se pudo sincronizar la lista de bloqueo.');
        }
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

  const updateEntry = useCallback(
    async (entryId: string, values: BlockListFormValues) => {
      await executeMutation([buildUpdateBlockListPayload(entryId, values)]);
    },
    [executeMutation],
  );

  const deleteEntry = useCallback(
    async (entryId: string) => {
      await executeMutation([buildDeleteBlockListPayload(entryId)]);
    },
    [executeMutation],
  );

  const enabledEntries = useMemo(() => entries.filter((entry) => entry.enabled), [entries]);

  return {
    entries,
    enabledEntries,
    isLoading,
    isMutating,
    error,
    syncedAt,
    refetch,
    createEntry,
    updateEntry,
    deleteEntry,
  };
}

// Re-export for consumers that imported from this hook before.
export type { SyncBlockListRecord } from '../lib/blocklist/types';
