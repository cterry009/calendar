import type { FocusEvent } from '../schemas/focus-event.js';
import type { PomodoroSession } from '../schemas/pomodoro.js';

/** A focus event before the device stamps it with an id and a time. */
export type FocusEventDraft = Omit<FocusEvent, 'id' | 'occurredAt'>;

function secondsSince(iso: string | null | undefined, now: number): number | undefined {
  if (!iso) return undefined;
  const ms = now - new Date(iso).getTime();
  return Number.isNaN(ms) ? undefined : Math.max(0, Math.round(ms / 1000));
}

/**
 * The focus events one pomodoro transition amounts to (telemetry, see the FocusEvent model).
 * `prev` is the session before, or null when `next` is a new session. Durations are seconds.
 */
export function pomodoroTransitionEvents(
  prev: PomodoroSession | null,
  next: PomodoroSession,
  reason?: string,
  now: number = Date.now(),
): FocusEventDraft[] {
  const events: FocusEventDraft[] = [];
  const same = !!prev && prev.id === next.id;
  const wasFocus = same && prev!.state === 'FOCUS';
  const wasBreak = same && (prev!.state === 'SHORT_BREAK' || prev!.state === 'LONG_BREAK');

  if (wasFocus && next.state !== 'FOCUS' && !next.interrupted) {
    events.push({ kind: 'FOCUS_COMPLETED', value: secondsSince(prev!.startedAt, now) });
  }
  if (wasBreak && next.state === 'FOCUS') {
    events.push({ kind: 'BREAK_COMPLETED', value: secondsSince(prev!.startedAt, now) });
  }
  if (next.state === 'FOCUS' && !wasFocus) {
    events.push({ kind: 'FOCUS_STARTED', meta: { cycle: next.completedCycles + 1 } });
  }
  if (same && prev!.active && !next.active) {
    events.push(
      next.interrupted
        ? {
            kind: 'SESSION_CANCELLED',
            value: secondsSince(prev!.startedAt, now),
            meta: { state: prev!.state, completedCycles: prev!.completedCycles, reason: reason ?? 'user' },
          }
        : { kind: 'BLOCK_ENDED', meta: { completedCycles: next.completedCycles } },
    );
  }
  return events;
}
