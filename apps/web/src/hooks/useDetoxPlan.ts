import { useCallback, useEffect, useState } from 'react';
import type { DetoxPlan } from '@calendar/shared';
import {
  completeBaselineAudit,
  completeDetoxDay,
  createDetoxPlan,
  toggleDetoxChecklistItem,
} from '@calendar/shared';
import { ApiError } from '../lib/api';
import { useSync } from '../context/SyncContext';
import type { SyncDetoxPlanRecord } from '../lib/calendar/types';
import {
  buildDeleteDetoxPayload,
  buildUpsertDetoxPayload,
  syncDetoxBatch,
} from '../lib/detox/sync';
import { clearDetoxPlan, loadDetoxPlan, saveDetoxPlan } from '../lib/offline/detox-store';
import { useSyncRefetch } from './useSyncRefetch';

interface UseDetoxPlanResult {
  plan: DetoxPlan | null;
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  startPlan: () => Promise<void>;
  saveBaselineAudit: (screenTimeHoursEstimate: number, topDistractions: string[]) => Promise<void>;
  toggleChecklistItem: (day: number, itemId: string) => Promise<void>;
  completeDay: (day: number) => Promise<void>;
  resetPlan: () => Promise<void>;
}

function parsePlanRecord(record: SyncDetoxPlanRecord | null | undefined): {
  plan: DetoxPlan | null;
  serverRecordId: string | null;
} {
  if (!record?.planData || typeof record.planData !== 'object') {
    return { plan: null, serverRecordId: null };
  }

  return {
    plan: record.planData as DetoxPlan,
    serverRecordId: record.id,
  };
}

export function useDetoxPlan(): UseDetoxPlanResult {
  const { pullSnapshot } = useSync();
  const [plan, setPlan] = useState<DetoxPlan | null>(null);
  const [serverRecordId, setServerRecordId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPlan = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const snapshot = await pullSnapshot();
      const server = parsePlanRecord(snapshot.detoxPlan);

      if (server.plan) {
        await saveDetoxPlan(server.plan);
        setPlan(server.plan);
        setServerRecordId(server.serverRecordId);
        return;
      }

      const local = await loadDetoxPlan();
      setPlan(local);
      setServerRecordId(null);
    } catch (errorValue) {
      const local = await loadDetoxPlan();
      setPlan(local);

      if (errorValue instanceof ApiError) {
        setError(errorValue.message);
      } else if (errorValue instanceof Error) {
        setError(errorValue.message);
      } else {
        setError('No se pudo cargar el plan de desintoxicacion.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [pullSnapshot]);

  useSyncRefetch('detoxPlan', loadPlan);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  const persist = useCallback(
    async (nextPlan: DetoxPlan, options?: { deleted?: boolean; recordId?: string | null }) => {
      setIsMutating(true);
      setError(null);

      try {
        if (options?.deleted) {
          const recordId = options.recordId ?? serverRecordId;
          if (recordId) {
            await syncDetoxBatch([buildDeleteDetoxPayload(recordId)]);
          }
          await clearDetoxPlan();
          setPlan(null);
          setServerRecordId(null);
          await loadPlan();
          return;
        }

        await saveDetoxPlan(nextPlan);
        setPlan(nextPlan);

        const response = await syncDetoxBatch([
          buildUpsertDetoxPayload(nextPlan, options?.recordId ?? serverRecordId),
        ]);

        const appliedRecord = response.applied?.detoxPlan?.[0] as
          | { record?: SyncDetoxPlanRecord }
          | undefined;
        if (appliedRecord?.record?.id) {
          setServerRecordId(appliedRecord.record.id);
        }

        await loadPlan();
      } catch (errorValue) {
        if (errorValue instanceof ApiError) {
          setError(errorValue.message);
        } else if (errorValue instanceof Error) {
          setError(errorValue.message);
        } else {
          setError('No se pudo sincronizar el plan de desintoxicacion.');
        }
        throw errorValue;
      } finally {
        setIsMutating(false);
      }
    },
    [loadPlan, serverRecordId],
  );

  const startPlan = useCallback(async () => {
    await persist(createDetoxPlan(crypto.randomUUID()));
  }, [persist]);

  const saveBaselineAudit = useCallback(
    async (screenTimeHoursEstimate: number, topDistractions: string[]) => {
      if (!plan) return;
      await persist(
        completeBaselineAudit(plan, {
          screenTimeHoursEstimate,
          topDistractions,
        }),
      );
    },
    [persist, plan],
  );

  const toggleChecklistItem = useCallback(
    async (day: number, itemId: string) => {
      if (!plan) return;
      await persist(toggleDetoxChecklistItem(plan, day, itemId));
    },
    [persist, plan],
  );

  const completeDay = useCallback(
    async (day: number) => {
      if (!plan) return;
      await persist(completeDetoxDay(plan, day));
    },
    [persist, plan],
  );

  const resetPlan = useCallback(async () => {
    if (serverRecordId) {
      await persist(plan ?? createDetoxPlan(crypto.randomUUID()), {
        deleted: true,
        recordId: serverRecordId,
      });
      return;
    }

    await clearDetoxPlan();
    setPlan(null);
  }, [persist, plan, serverRecordId]);

  return {
    plan,
    isLoading,
    isMutating,
    error,
    startPlan,
    saveBaselineAudit,
    toggleChecklistItem,
    completeDay,
    resetPlan,
  };
}
