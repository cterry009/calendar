import { useCallback, useEffect, useState } from 'react';
import {
  createEmptyRitualState,
  loadTodayRitual,
  saveTodayRitual,
  type DailyRitualState,
} from '../lib/offline/ritual-store';

interface UseDailyRitualResult {
  state: DailyRitualState;
  isLoading: boolean;
  markMorningDone: () => Promise<void>;
  markEveningDone: (reflection: string) => Promise<void>;
  reopenMorning: () => void;
  reopenEvening: () => void;
}

export function useDailyRitual(): UseDailyRitualResult {
  const [state, setState] = useState<DailyRitualState>(() => createEmptyRitualState());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const loaded = await loadTodayRitual();
      setState(loaded);
      setIsLoading(false);
    })();
  }, []);

  const markMorningDone = useCallback(async () => {
    const next = { ...state, morningCompletedAt: new Date().toISOString() };
    setState(next);
    await saveTodayRitual(next);
  }, [state]);

  const markEveningDone = useCallback(
    async (reflection: string) => {
      const next = { ...state, eveningCompletedAt: new Date().toISOString(), reflection };
      setState(next);
      await saveTodayRitual(next);
    },
    [state],
  );

  // "Reopen" only clears the local completed-today flag so the flow re-renders -- it doesn't
  // undo `onRitual(...)` on the shared serotonin session, which stays completed for the day.
  const reopenMorning = useCallback(() => {
    setState((previous) => {
      const next = { ...previous, morningCompletedAt: undefined };
      void saveTodayRitual(next);
      return next;
    });
  }, []);

  const reopenEvening = useCallback(() => {
    setState((previous) => {
      const next = { ...previous, eveningCompletedAt: undefined };
      void saveTodayRitual(next);
      return next;
    });
  }, []);

  return { state, isLoading, markMorningDone, markEveningDone, reopenMorning, reopenEvening };
}
