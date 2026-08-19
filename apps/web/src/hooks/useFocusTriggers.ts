import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../lib/api';
import { useSync } from '../context/SyncContext';
import {
  buildCreateFocusTriggerPayload,
  buildDeleteFocusTriggerPayload,
  buildUpdateFocusTriggerPayload,
  syncFocusTriggerBatch,
} from '../lib/focusTriggers/sync';
import type { FocusTriggerFormValues, SyncFocusTriggerRecord } from '../lib/focusTriggers/types';
import { useSyncRefetch } from './useSyncRefetch';

interface UseFocusTriggersResult {
  triggers: SyncFocusTriggerRecord[];
  enabledTriggers: SyncFocusTriggerRecord[];
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createTrigger: (values: FocusTriggerFormValues) => Promise<void>;
  updateTrigger: (triggerId: string, values: FocusTriggerFormValues) => Promise<void>;
  deleteTrigger: (triggerId: string) => Promise<void>;
}

function sortTriggers(items: SyncFocusTriggerRecord[]) {
  return [...items].sort((a, b) => a.label.localeCompare(b.label));
}

export function useFocusTriggers(): UseFocusTriggersResult {
  const { pullSnapshot } = useSync();
  const [triggers, setTriggers] = useState<SyncFocusTriggerRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await pullSnapshot();
      setTriggers(sortTriggers((data.focusTriggers as SyncFocusTriggerRecord[]) ?? []));
    } catch (errorValue) {
      if (errorValue instanceof ApiError) {
        setError(errorValue.message);
      } else if (errorValue instanceof Error) {
        setError(errorValue.message);
      } else {
        setError('No se pudieron cargar las condiciones de activacion.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [pullSnapshot]);

  useSyncRefetch('focusTriggers', refetch);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const executeMutation = useCallback(
    async (changes: Parameters<typeof syncFocusTriggerBatch>[0]) => {
      setIsMutating(true);
      setError(null);

      try {
        await syncFocusTriggerBatch(changes);
        await refetch();
      } catch (errorValue) {
        if (errorValue instanceof ApiError) {
          setError(errorValue.message);
        } else if (errorValue instanceof Error) {
          setError(errorValue.message);
        } else {
          setError('No se pudo sincronizar la condicion de activacion.');
        }
        throw errorValue;
      } finally {
        setIsMutating(false);
      }
    },
    [refetch],
  );

  const createTrigger = useCallback(
    async (values: FocusTriggerFormValues) => {
      await executeMutation([buildCreateFocusTriggerPayload(values)]);
    },
    [executeMutation],
  );

  const updateTrigger = useCallback(
    async (triggerId: string, values: FocusTriggerFormValues) => {
      await executeMutation([buildUpdateFocusTriggerPayload(triggerId, values)]);
    },
    [executeMutation],
  );

  const deleteTrigger = useCallback(
    async (triggerId: string) => {
      await executeMutation([buildDeleteFocusTriggerPayload(triggerId)]);
    },
    [executeMutation],
  );

  const enabledTriggers = useMemo(() => triggers.filter((trigger) => trigger.enabled), [triggers]);

  return {
    triggers,
    enabledTriggers,
    isLoading,
    isMutating,
    error,
    refetch,
    createTrigger,
    updateTrigger,
    deleteTrigger,
  };
}
