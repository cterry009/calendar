import { useSyncExternalStore } from 'react';

// UI state shared by the focus view, the block pill, the diagnosis card and the reminders
// (dynamic-study-blocks D16, D17, revision 2): which phase the user collapsed the view for, which
// suggested block the "Empezar" card is for, a request for the pill's "Salir" flow, and the last
// pomodoro's rating and the last diagnosis, which the ±10 rule and the next diagnosis start from.

export interface LastRating {
  sessionId: string;
  cycle: number;
  /** 0-100; null when the card was dismissed. */
  rating: number | null;
}

interface FocusViewState {
  /** The phase (phaseKey) the view was collapsed for; a new phase shows it again. */
  collapsedFor: string | null;
  starterOpen: boolean;
  /** The suggested block (schedule) the card starts; null: the next one due. */
  starterScheduleId: string | null;
  /** Bumped to ask the pill to open its "¿Por qué sales?" card. */
  exitRequests: number;
  lastRating: LastRating | null;
  /** The day's last diagnosis, where the sliders start. */
  lastDiagnosis: { motivation: number; concentration: number } | null;
}

const LAST_DIAGNOSIS_KEY = 'calendar:last-diagnosis';

function loadLastDiagnosis(): FocusViewState['lastDiagnosis'] {
  try {
    const raw = window.localStorage.getItem(LAST_DIAGNOSIS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { date: string; motivation: number; concentration: number };
    // Only today's: yesterday's energy says little about this morning.
    return parsed.date === new Date().toDateString()
      ? { motivation: parsed.motivation, concentration: parsed.concentration }
      : null;
  } catch {
    return null;
  }
}

let state: FocusViewState = {
  collapsedFor: null,
  starterOpen: false,
  starterScheduleId: null,
  exitRequests: 0,
  lastRating: null,
  lastDiagnosis: typeof window === 'undefined' ? null : loadLastDiagnosis(),
};
const listeners = new Set<() => void>();

function set(patch: Partial<FocusViewState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useFocusViewState(): FocusViewState {
  return useSyncExternalStore(subscribe, () => state);
}

/** One phase of a session: its id, state, segment and start. */
export function phaseKey(session: {
  id: string;
  state: string;
  segmentIndex?: number | null;
  startedAt?: string | null;
}): string {
  return `${session.id}:${session.state}:${session.segmentIndex ?? ''}:${session.startedAt ?? ''}`;
}

export const focusView = {
  collapse: (key: string) => set({ collapsedFor: key }),
  expand: () => set({ collapsedFor: null }),
  openStarter: (scheduleId: string | null = null) =>
    set({ starterOpen: true, starterScheduleId: scheduleId }),
  closeStarter: () => set({ starterOpen: false, starterScheduleId: null }),
  /** "Salir" from the view: collapse it for this phase and let the pill ask why. */
  requestExit: (key: string) => set({ exitRequests: state.exitRequests + 1, collapsedFor: key }),
  setLastRating: (lastRating: LastRating) => set({ lastRating }),
  setLastDiagnosis: (motivation: number, concentration: number) => {
    try {
      window.localStorage.setItem(
        LAST_DIAGNOSIS_KEY,
        JSON.stringify({ date: new Date().toDateString(), motivation, concentration }),
      );
    } catch {
      // Private mode: the sliders just start in the middle next time.
    }
    set({ lastDiagnosis: { motivation, concentration } });
  },
};
