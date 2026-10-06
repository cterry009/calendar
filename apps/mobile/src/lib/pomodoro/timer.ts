import { getPhaseDurationMinutes, sessionClock, type PomodoroSession } from '@calendar/shared';

export function getRemainingSeconds(
  session: Pick<
    PomodoroSession,
    | 'state'
    | 'startedAt'
    | 'focusDurationMin'
    | 'shortBreakMin'
    | 'longBreakMin'
    | 'cyclesBeforeLongBreak'
    | 'completedCycles'
    | 'active'
    | 'interrupted'
    | 'taskId'
    | 'endedAt'
    | 'pausedAt'
  >,
  now = Date.now(),
): number {
  if (!session.active || !session.startedAt) {
    return 0;
  }

  const phaseDurationMinutes = getPhaseDurationMinutes(session);
  if (!phaseDurationMinutes) {
    return 0;
  }

  const startedAtMs = new Date(session.startedAt).getTime();
  if (Number.isNaN(startedAtMs)) {
    return 0;
  }

  // Paused ("Salir"): the clock stopped when the user left.
  const elapsedSeconds = Math.max(0, Math.floor((sessionClock(session, now) - startedAtMs) / 1000));
  return Math.max(0, phaseDurationMinutes * 60 - elapsedSeconds);
}

export function formatTimer(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (safeSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}
