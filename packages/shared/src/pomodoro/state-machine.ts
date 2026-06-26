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
