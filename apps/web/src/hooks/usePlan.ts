import { useCallback, useEffect, useState } from 'react';
import type { ScheduleExceptionLike, StudyPlanData } from '@calendar/shared';
import { useSync } from '../context/SyncContext';
import { toExceptionLikes } from '../lib/plan/sync';
import { useSyncRefetch } from './useSyncRefetch';

export interface PlanState {
  /** Null until the timetable is loaded (Horario page). */
  plan: StudyPlanData | null;
  exceptions: ScheduleExceptionLike[];
  isLoading: boolean;
  refetch: () => Promise<void>;
}

// The study plan and the one-off block changes (horario 2026-10-19), from the synced snapshot.
export function usePlan(): PlanState {
  const { pullSnapshot } = useSync();
  const [plan, setPlan] = useState<StudyPlanData | null>(null);
  const [exceptions, setExceptions] = useState<ScheduleExceptionLike[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const snapshot = await pullSnapshot();
      setPlan(snapshot.studyPlan?.planData ?? null);
      setExceptions(toExceptionLikes(snapshot.scheduleExceptions));
    } catch {
      // Keep the last known plan.
    } finally {
      setIsLoading(false);
    }
  }, [pullSnapshot]);

  useSyncRefetch('studyPlan', refetch);
  useSyncRefetch('scheduleExceptions', refetch);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { plan, exceptions, isLoading, refetch };
}
