import type { PomodoroConfig, PomodoroSession } from '../schemas/pomodoro.js';
import type { PomodoroState } from '../schemas/enums.js';

export type PomodoroEvent =
  | { type: 'START'; taskId?: string | null }
  | { type: 'FOCUS_COMPLETE' }
  | { type: 'BREAK_COMPLETE' }
  | { type: 'CANCEL' }
  | { type: 'RESET' };

export const DEFAULT_POMODORO_CONFIG: PomodoroConfig = {
  focusDurationMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  cyclesBeforeLongBreak: 4,
};

export function createPomodoroSession(
  id: string,
  config: PomodoroConfig = DEFAULT_POMODORO_CONFIG,
): PomodoroSession {
  return {
    id,
    taskId: null,
    state: 'IDLE',
    focusDurationMin: config.focusDurationMin,
    shortBreakMin: config.shortBreakMin,
    longBreakMin: config.longBreakMin,
    cyclesBeforeLongBreak: config.cyclesBeforeLongBreak,
    completedCycles: 0,
    active: false,
    interrupted: false,
    startedAt: null,
    endedAt: null,
  };
}

export function getPhaseDurationMinutes(
  session: PomodoroSession,
): number | null {
  switch (session.state) {
    case 'FOCUS':
      return session.focusDurationMin;
    case 'SHORT_BREAK':
      return session.shortBreakMin;
    case 'LONG_BREAK':
      return session.longBreakMin;
    default:
      return null;
  }
}

export function transitionPomodoro(
  session: PomodoroSession,
  event: PomodoroEvent,
): PomodoroSession {
  switch (event.type) {
    case 'START':
      return startFocus(session, event.taskId);
    case 'FOCUS_COMPLETE':
      return completeFocus(session);
    case 'BREAK_COMPLETE':
      return completeBreak(session);
    case 'CANCEL':
      return cancelSession(session);
    case 'RESET':
      return resetSession(session);
    default:
      return session;
  }
}

function startFocus(
  session: PomodoroSession,
  taskId?: string | null,
): PomodoroSession {
  if (session.state !== 'IDLE' || session.active) {
    return session;
  }

  return {
    ...session,
    state: 'FOCUS',
    active: true,
    interrupted: false,
    taskId: taskId ?? null,
    startedAt: new Date().toISOString(),
    endedAt: null,
  };
}

function completeFocus(session: PomodoroSession): PomodoroSession {
  if (session.state !== 'FOCUS') {
    return session;
  }

  const nextCompletedCycles = session.completedCycles + 1;
  const nextState: PomodoroState =
    nextCompletedCycles % session.cyclesBeforeLongBreak === 0
      ? 'LONG_BREAK'
      : 'SHORT_BREAK';

  return {
    ...session,
    state: nextState,
    completedCycles: nextCompletedCycles,
    startedAt: new Date().toISOString(),
  };
}

function completeBreak(session: PomodoroSession): PomodoroSession {
  if (session.state !== 'SHORT_BREAK' && session.state !== 'LONG_BREAK') {
    return session;
  }

  return {
    ...session,
    state: 'FOCUS',
    startedAt: new Date().toISOString(),
  };
}

function cancelSession(session: PomodoroSession): PomodoroSession {
  if (session.state === 'IDLE' && !session.active) {
    return session;
  }

  return {
    ...session,
    state: 'IDLE',
    active: false,
    interrupted: true,
    endedAt: new Date().toISOString(),
  };
}

function resetSession(session: PomodoroSession): PomodoroSession {
  return {
    ...session,
    state: 'IDLE',
    completedCycles: 0,
    active: false,
    interrupted: false,
    taskId: null,
    startedAt: null,
    endedAt: null,
  };
}

export function isBlockingPhase(session: PomodoroSession): boolean {
  return session.active && session.state === 'FOCUS';
}

// FOCUS_COMPLETE/BREAK_COMPLETE never clear `active` -- by design, a pomodoro auto-cycles
// focus/break/focus/break until the user explicitly cancels it (the standard pomodoro pattern).
// But that means a session left active while the app is closed for hours or days doesn't just
// wait patiently: the moment it's next observed, its elapsed wall-clock time is wildly past the
// current phase's duration, and the client "completes" it on the spot -- firing a phase-complete
// notification for a phase the user never experienced, then immediately starting a fresh phase
// (with real focus-mode app-blocking, if that fresh phase is FOCUS) nobody asked for. This grace
// window draws the line between "a little late coming back" (finish the phase normally) and
// "abandoned" (silently end the session instead) so a session someone genuinely forgot about
// doesn't keep resurrecting itself and spamming notifications indefinitely.
export const ABANDONED_PHASE_GRACE_MS = 15 * 60 * 1000;

export function isPhaseAbandoned(session: PomodoroSession, now: number): boolean {
  if (!session.active || !session.startedAt) {
    return false;
  }

  const phaseDurationMinutes = getPhaseDurationMinutes(session);
  if (!phaseDurationMinutes) {
    return false;
  }

  const startedAtMs = new Date(session.startedAt).getTime();
  if (Number.isNaN(startedAtMs)) {
    return false;
  }

  const overdueMs = now - startedAtMs - phaseDurationMinutes * 60_000;
  return overdueMs > ABANDONED_PHASE_GRACE_MS;
}
