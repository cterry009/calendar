import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useState } from 'react';
import { useSync } from '../context/SyncContext';
import { ApiError } from '../lib/auth/api';
import {
  buildCreateBlockListPayload,
  buildDeleteBlockListPayload,
  buildUpdateBlockListPayload,
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
  /** A NIGHT entry's own start times (weekend-mode). */
  updateNightStarts: (entry: SyncBlockListRecord, nightStartMinutes: number | null, weekendNightStartMinutes: number | null) => Promise<void>;
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

  // Same fix as useFitness.ts's executeMutation: syncBlockListBatch() never rejects when offline
  // (or when an online request fails) -- it queues the change and resolves successfully -- so a
  // plain refetch() afterwards would silently revert to the stale pre-change list, e.g. toggling
  // an installed app into the block list and having it disappear again on the next refetch.
  // Checks the `queued` flag and, when true, patches `entries` directly instead of trusting a
  // refetch that can't possibly reflect a mutation the server never received yet.
  const executeMutation = useCallback(
    async (
      changes: Parameters<typeof syncBlockListBatch>[0],
      applyOptimistically: (current: SyncBlockListRecord[]) => SyncBlockListRecord[],
    ) => {
      setIsMutating(true);
      setError(null);

      try {
        const response = await syncBlockListBatch(changes);
        if (response.queued) {
          setEntries((current) => sortByLabel(applyOptimistically(current)));
        } else {
          await refetch();
        }
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
      const nowIso = new Date().toISOString();
      const optimisticEntry: SyncBlockListRecord = {
        id: `pending-${Crypto.randomUUID()}`,
        kind: values.kind,
        identifier: values.identifier.trim(),
        label: values.label.trim(),
        platform: values.platform,
        highDopamine: values.highDopamine,
        enabled: values.enabled,
        hardMode: values.hardMode,
        scope: values.scope,
        nightStartMinutes: values.nightStartMinutes ?? null,
        weekendNightStartMinutes: values.weekendNightStartMinutes ?? null,
        updatedAt: nowIso,
      };
      await executeMutation([buildCreateBlockListPayload(values)], (current) => [...current, optimisticEntry]);
    },
    [executeMutation],
  );

  const updateNightStarts = useCallback(
    async (entry: SyncBlockListRecord, nightStartMinutes: number | null, weekendNightStartMinutes: number | null) => {
      const payload = buildUpdateBlockListPayload(entry.id, { ...entry, nightStartMinutes, weekendNightStartMinutes });
      await executeMutation([payload], (current) =>
        current.map((row) => (row.id === entry.id ? { ...row, nightStartMinutes, weekendNightStartMinutes } : row)),
      );
    },
    [executeMutation],
  );

  const deleteEntry = useCallback(
    async (entryId: string) => {
      await executeMutation([buildDeleteBlockListPayload(entryId)], (current) =>
        current.filter((entry) => entry.id !== entryId),
      );
    },
    [executeMutation],
  );

  return { entries, isLoading, isMutating, error, refetch, createEntry, updateNightStarts, deleteEntry };
}
