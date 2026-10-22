import { useSyncExternalStore } from 'react';

// UI state shared by the focus view, the block pill, the check-in card and the reminders
// (dynamic-study-blocks D16, D17): which phase the user collapsed the view for, whether the
// "Empezar bloque" card is open, and a request for the pill's "Salir" flow.

interface FocusViewState {
  /** The phase (phaseKey) the view was collapsed for; a new phase shows it again. */
  collapsedFor: string | null;
  starterOpen: boolean;
  /** Bumped to ask the pill to open its "¿Por qué sales?" card. */
  exitRequests: number;
}

let state: FocusViewState = { collapsedFor: null, starterOpen: false, exitRequests: 0 };
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
  openStarter: () => set({ starterOpen: true }),
  closeStarter: () => set({ starterOpen: false }),
  /** Salir from the view: collapse it for this phase and let the pill ask why. */
  requestExit: (key: string) => set({ exitRequests: state.exitRequests + 1, collapsedFor: key }),
};
