import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BlockListKind, DevicePlatform } from '@calendar/shared';
import { ApiError, apiFetch } from '../lib/api';

export interface SyncBlockListEntry {
  id: string;
  kind: BlockListKind;
  identifier: string;
  label: string;
  platform: DevicePlatform | null;
  highDopamine: boolean;
  enabled: boolean;
  updatedAt: string;
}

interface BlockListSnapshotResponse {
  blockListEntries: SyncBlockListEntry[];
  syncedAt: string;
}

interface UseBlockListResult {
  entries: SyncBlockListEntry[];
  enabledEntries: SyncBlockListEntry[];
  isLoading: boolean;
  error: string | null;
  syncedAt: string | null;
  refetch: () => Promise<void>;
}

export function useBlockList(): UseBlockListResult {
  const [entries, setEntries] = useState<SyncBlockListEntry[]>([]);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiFetch<BlockListSnapshotResponse>('/sync/pull');
      setEntries(data.blockListEntries ?? []);
      setSyncedAt(data.syncedAt);
    } catch (errorValue) {
      if (errorValue instanceof ApiError) {
        setError(errorValue.message);
      } else {
        setError('No se pudo cargar la lista de bloqueo.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const enabledEntries = useMemo(() => entries.filter((entry) => entry.enabled), [entries]);

  return {
    entries,
    enabledEntries,
    isLoading,
    error,
    syncedAt,
    refetch,
  };
}
