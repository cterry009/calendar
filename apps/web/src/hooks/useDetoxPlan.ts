import { useCallback, useEffect, useState } from 'react';
import type { DetoxPlan } from '@calendar/shared';
import {
  completeBaselineAudit,
  completeDetoxDay,
  createDetoxPlan,
  toggleDetoxChecklistItem,
} from '@calendar/shared';
import { clearDetoxPlan, loadDetoxPlan, saveDetoxPlan } from '../lib/offline/detox-store';

interface UseDetoxPlanResult {
  plan: DetoxPlan | null;
  isLoading: boolean;
  startPlan: () => Promise<void>;
  saveBaselineAudit: (screenTimeHoursEstimate: number, topDistractions: string[]) => Promise<void>;
  toggleChecklistItem: (day: number, itemId: string) => Promise<void>;
  completeDay: (day: number) => Promise<void>;
  resetPlan: () => Promise<void>;
}

export function useDetoxPlan(): UseDetoxPlanResult {
  const [plan, setPlan] = useState<DetoxPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const persist = useCallback(async (nextPlan: DetoxPlan) => {
    await saveDetoxPlan(nextPlan);
    setPlan(nextPlan);
  }, []);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const stored = await loadDetoxPlan();
      if (mounted) {
        setPlan(stored);
        setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const startPlan = useCallback(async () => {
    const nextPlan = createDetoxPlan(crypto.randomUUID());
    await persist(nextPlan);
  }, [persist]);

  const saveBaselineAudit = useCallback(
    async (screenTimeHoursEstimate: number, topDistractions: string[]) => {
      if (!plan) return;
      const nextPlan = completeBaselineAudit(plan, {
        screenTimeHoursEstimate,
        topDistractions,
      });
      await persist(nextPlan);
    },
    [persist, plan],
  );

  const toggleChecklistItem = useCallback(
    async (day: number, itemId: string) => {
      if (!plan) return;
      const nextPlan = toggleDetoxChecklistItem(plan, day, itemId);
      await persist(nextPlan);
    },
    [persist, plan],
  );

  const completeDay = useCallback(
    async (day: number) => {
      if (!plan) return;
      const nextPlan = completeDetoxDay(plan, day);
      await persist(nextPlan);
    },
    [persist, plan],
  );

  const resetPlan = useCallback(async () => {
    await clearDetoxPlan();
    setPlan(null);
  }, []);

  return {
    plan,
    isLoading,
    startPlan,
    saveBaselineAudit,
    toggleChecklistItem,
    completeDay,
    resetPlan,
  };
}
