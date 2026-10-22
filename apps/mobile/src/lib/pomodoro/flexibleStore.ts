import { useSyncExternalStore } from 'react';

// What the phone remembers between screens for flexible blocks (dynamic-study-blocks revision 2):
// the last pomodoro's rating, which the next focus's ±10 rule reads, and the day's last diagnosis,
// where the next one starts. In memory: a restart just asks again from the middle. Mirrors the web's
// lib/focusView/store.ts.

interface FlexibleState {
  lastRating: { sessionId: string; cycle: number; rating: number | null } | null;
  lastDiagnosis: { date: string; motivation: number; concentration: number } | null;
}

let state: FlexibleState = { lastRating: null, lastDiagnosis: null };
const listeners = new Set<() => void>();

function set(patch: Partial<FlexibleState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export function useFlexibleState(): FlexibleState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}

/** Today's last diagnosis, or null. */
export function todaysDiagnosis(s: FlexibleState): { motivation: number; concentration: number } | null {
  return s.lastDiagnosis && s.lastDiagnosis.date === new Date().toDateString() ? s.lastDiagnosis : null;
}

export const flexibleStore = {
  setLastRating: (sessionId: string, cycle: number, rating: number | null) => set({ lastRating: { sessionId, cycle, rating } }),
  setLastDiagnosis: (motivation: number, concentration: number) =>
    set({ lastDiagnosis: { date: new Date().toDateString(), motivation, concentration } }),
};
