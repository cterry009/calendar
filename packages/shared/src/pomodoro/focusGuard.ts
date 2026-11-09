// focus-session-flow (2026-11-09): a pomodoro only ends once most of its focus is done. Before that the
// apps offer only "Pausar" (the PAUSE event, which keeps the focus done so far). Applied by the apps to
// their end controls ("Terminar pomodoro", "Cortar tramo", "Terminar bloque"); the state machine's
// transitions are unchanged, so syncing an end that happened elsewhere still works.

import type { PomodoroSession } from '../schemas/pomodoro.js';
import { currentSegment, getPhaseDurationMinutes, sessionClock } from './state-machine.js';

/** Between the 70 and 80 % the user named. */
export const MIN_FOCUS_TO_END = 0.75;

export interface EndFocusCheck {
  allowed: boolean;
  /** Focus minutes done in the running segment (pauses don't count). */
  doneMin: number;
  plannedMin: number | null;
  /** Whole minutes still needed before ending is allowed; 0 when allowed. */
  minutesLeft: number;
}

export function canEndFocus(session: PomodoroSession, now: number = Date.now()): EndFocusCheck {
  const free = (doneMin = 0, plannedMin: number | null = null): EndFocusCheck => ({
    allowed: true,
    doneMin,
    plannedMin,
    minutesLeft: 0,
  });
  if (!session.active || session.state !== 'FOCUS' || !session.startedAt) return free();
  // The closing segment is not a pomodoro: it can always end.
  if (currentSegment(session)?.tipo === 'cierre') return free();
  const plannedMin = getPhaseDurationMinutes(session);
  if (!plannedMin) return free(0, plannedMin);
  // Resume moves startedAt forward by the paused time, so this is focus time only.
  const doneMin = Math.max(0, (sessionClock(session, now) - new Date(session.startedAt).getTime()) / 60_000);
  const neededMin = plannedMin * MIN_FOCUS_TO_END;
  if (doneMin >= neededMin) return free(doneMin, plannedMin);
  return { allowed: false, doneMin, plannedMin, minutesLeft: Math.ceil(neededMin - doneMin) };
}
