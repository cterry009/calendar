import type { PomodoroConfig, PomodoroSession } from '../schemas/pomodoro.js';
import type { PomodoroState } from '../schemas/enums.js';
import { ATTENTION_PROFILE_SPECS, MIN_TRIMMED_FOCUS_MIN, type AttentionProfile } from '../attention/profiles.js';
import { fitSequence, isWorkSegment, segmentIndexAt, type SequenceSegment, type TimedSegment } from '../plan/sequence.js';

export type PomodoroEvent =
  | { type: 'START'; taskId?: string | null }
  | { type: 'FOCUS_COMPLETE' }
  | { type: 'BREAK_COMPLETE' }
  | { type: 'CANCEL' }
  | { type: 'RESET' }
  // "Salir": stop counting (`at`: ISO, when the exit happened elsewhere and is applied late).
  | { type: 'PAUSE'; at?: string }
  // "Volver al bloque": count again from where it stopped; past the block's end, the block ends.
  | { type: 'RESUME' }
  // "Cortar tramo" (sequence mode): end the running focus segment and start the next pause now.
  | { type: 'CUT_SEGMENT' };

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

/**
 * A session for a WORK block: the profile's pomodoro and break, ending at the block's fixed end.
 * Started late, it simply fits fewer pomodoros before that end.
 */
export function createBlockPomodoroSession(
  id: string,
  profile: AttentionProfile,
  blockEndAt: string,
  /** The block's own pomodoro (blockOnDay's focusMin/breakMin); the profile's when omitted. */
  timing?: { focusMin: number; breakMin: number },
): PomodoroSession {
  const { focusMin, breakMin } = timing ?? ATTENTION_PROFILE_SPECS[profile];
  return {
    ...createPomodoroSession(id, { focusDurationMin: focusMin, shortBreakMin: breakMin, longBreakMin: breakMin, cyclesBeforeLongBreak: 4 }),
    blockEndAt,
    attentionProfile: profile,
  };
}

/**
 * A session for a block with a pomodoro sequence (horario 2026-10-19). Its segments are anchored
 * to the block's start, so the session always knows which one is running from the clock alone.
 * The focus/break minutes are the sequence's first ones, for screens that only show those.
 */
export function createSequenceBlockSession(
  id: string,
  profile: AttentionProfile,
  blockStartAt: string,
  blockEndAt: string,
  /** Already labelled for the block's category (PlanOccurrence segments, or labelSequence). */
  sequence: SequenceSegment[],
): PomodoroSession {
  const focusMin = sequence.find((s) => s.tipo === 'foco')?.minutos ?? DEFAULT_POMODORO_CONFIG.focusDurationMin;
  const breakMin = sequence.find((s) => s.tipo === 'pausa')?.minutos ?? DEFAULT_POMODORO_CONFIG.shortBreakMin;
  return {
    ...createPomodoroSession(id, { focusDurationMin: focusMin, shortBreakMin: breakMin, longBreakMin: breakMin, cyclesBeforeLongBreak: 4 }),
    blockStartAt,
    blockEndAt,
    sequence: sequence.map(({ tipo, minutos, etiqueta }) => ({ tipo, minutos, etiqueta })),
    segmentIndex: null,
    cutCount: 0,
    attentionProfile: profile,
  };
}

type SequenceFields = Pick<PomodoroSession, 'sequence' | 'blockStartAt' | 'blockEndAt'>;

/** The session's segments placed in its block; null outside sequence mode. */
export function sessionSegments(session: SequenceFields): TimedSegment[] | null {
  if (!session.sequence?.length || !session.blockStartAt || !session.blockEndAt) return null;
  const start = new Date(session.blockStartAt).getTime();
  const end = new Date(session.blockEndAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  return fitSequence(session.sequence, Math.round((end - start) / 60_000)).segments;
}

/** The running segment of a sequence session, if any. */
export function currentSegment(session: SequenceFields & Pick<PomodoroSession, 'segmentIndex'>): TimedSegment | null {
  const segments = sessionSegments(session);
  if (!segments || session.segmentIndex == null) return null;
  return segments[session.segmentIndex] ?? null;
}

/** "Cortar tramo" is offered: a focus segment is running and a pause follows it. */
export function canCutSegment(session: PomodoroSession): boolean {
  if (!session.active || session.pausedAt || session.state !== 'FOCUS') return false;
  const segments = sessionSegments(session);
  if (!segments || session.segmentIndex == null) return false;
  return segments[session.segmentIndex]?.tipo === 'foco' && segments[session.segmentIndex + 1]?.tipo === 'pausa';
}

function segmentOffsetMin(session: SequenceFields, at: number): number {
  return (at - new Date(session.blockStartAt!).getTime()) / 60_000;
}

function segmentEndMs(session: SequenceFields, segment: TimedSegment): number {
  return new Date(session.blockStartAt!).getTime() + segment.endOffset * 60_000;
}

function stateForSegment(segment: TimedSegment): PomodoroState {
  if (isWorkSegment(segment)) return 'FOCUS';
  return segment.minutos >= 15 ? 'LONG_BREAK' : 'SHORT_BREAK';
}

/** Runs segment `index` from now (or ends the block if there's none left). */
function enterSegment(session: PomodoroSession, segments: TimedSegment[], index: number): PomodoroSession {
  const now = Date.now();
  // Skip segments already over (the device was asleep) or with under a minute left.
  let i = index;
  while (i < segments.length && segmentEndMs(session, segments[i]) - now < 60_000) i++;
  if (i >= segments.length) return endBlock(session);
  return { ...session, state: stateForSegment(segments[i]), segmentIndex: i, startedAt: new Date(now).toISOString() };
}

/** Minutes from `from` (ISO, default now) to the block's end; null outside block mode. */
export function minutesToBlockEnd(session: Pick<PomodoroSession, 'blockEndAt'>, from: number = Date.now()): number | null {
  if (!session.blockEndAt) return null;
  const end = new Date(session.blockEndAt).getTime();
  return Number.isNaN(end) ? null : (end - from) / 60_000;
}

export function getPhaseDurationMinutes(
  session: PomodoroSession,
): number | null {
  const base =
    session.state === 'FOCUS'
      ? session.focusDurationMin
      : session.state === 'SHORT_BREAK'
        ? session.shortBreakMin
        : session.state === 'LONG_BREAK'
          ? session.longBreakMin
          : null;
  if (base === null || !session.startedAt) return base;
  // Sequence mode: the running segment ends at its fixed clock time.
  const segment = currentSegment(session);
  if (segment) {
    return Math.max(0, (segmentEndMs(session, segment) - new Date(session.startedAt).getTime()) / 60_000);
  }
  // In block mode no phase runs past the block's end.
  const left = minutesToBlockEnd(session, new Date(session.startedAt).getTime());
  return left === null ? base : Math.max(0, Math.min(base, left));
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
    case 'PAUSE':
      return pauseSession(session, event.at);
    case 'RESUME':
      return resumeSession(session);
    case 'CUT_SEGMENT':
      return cutSegment(session);
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
  const segments = sessionSegments(session);
  if (segments) {
    // Sequence mode: join the segment running now; inside a pause, start the next focus early.
    let index = segmentIndexAt(segments, segmentOffsetMin(session, Date.now()));
    if (index < 0) return session;
    while (index < segments.length && !isWorkSegment(segments[index])) index++;
    if (index >= segments.length) return session;
    const started = enterSegment({ ...session, active: true, interrupted: false, taskId: taskId ?? null, endedAt: null }, segments, index);
    return started.active ? started : session;
  }
  const left = minutesToBlockEnd(session);
  if (left !== null && left < MIN_TRIMMED_FOCUS_MIN) {
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

function pauseSession(session: PomodoroSession, at?: string): PomodoroSession {
  if (!session.active || session.state === 'IDLE' || session.pausedAt) return session;
  const now = new Date().toISOString();
  // An exit reported late never lands before the phase began or in the future.
  const pausedAt = at && session.startedAt && at > session.startedAt && at < now ? at : now;
  return { ...session, pausedAt, exitCount: (session.exitCount ?? 0) + 1 };
}

function resumeSession(session: PomodoroSession): PomodoroSession {
  if (!session.pausedAt || !session.startedAt) return session;
  const segments = sessionSegments(session);
  if (segments) {
    // The sequence runs on the clock: coming back joins whatever segment is running now.
    const index = segmentIndexAt(segments, segmentOffsetMin(session, Date.now()));
    return enterSegment({ ...session, pausedAt: null }, segments, index < 0 ? segments.length : index);
  }
  const left = minutesToBlockEnd(session);
  if (left !== null && left < MIN_TRIMMED_FOCUS_MIN) return endBlock({ ...session, pausedAt: null });
  const pausedMs = Date.now() - new Date(session.pausedAt).getTime();
  const startedAt = new Date(new Date(session.startedAt).getTime() + Math.max(0, pausedMs)).toISOString();
  return { ...session, startedAt, pausedAt: null };
}

/** The moment time is measured at: now, or when the session was paused. */
export function sessionClock(session: Pick<PomodoroSession, 'pausedAt'>, now: number = Date.now()): number {
  if (!session.pausedAt) return now;
  const paused = new Date(session.pausedAt).getTime();
  return Number.isNaN(paused) ? now : Math.min(now, paused);
}

function completeFocus(session: PomodoroSession): PomodoroSession {
  if (session.pausedAt) return session;
  if (session.state !== 'FOCUS') {
    return session;
  }

  const segments = sessionSegments(session);
  if (segments && session.segmentIndex != null) {
    // Only focus segments are pomodoros; the closing one isn't.
    const finished = segments[session.segmentIndex];
    const completedCycles = session.completedCycles + (finished?.tipo === 'foco' ? 1 : 0);
    return advanceSequence({ ...session, completedCycles }, segments);
  }
  const nextCompletedCycles = session.completedCycles + 1;
  const left = minutesToBlockEnd(session);
  if (left !== null) {
    // Block mode: short breaks only (the long break is the one between blocks), and the session
    // ends when the block does.
    if (left <= 0) return endBlock({ ...session, completedCycles: nextCompletedCycles });
    return { ...session, state: 'SHORT_BREAK', completedCycles: nextCompletedCycles, startedAt: new Date().toISOString() };
  }
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
  if (session.pausedAt) return session;
  if (session.state !== 'SHORT_BREAK' && session.state !== 'LONG_BREAK') {
    return session;
  }
  const segments = sessionSegments(session);
  if (segments && session.segmentIndex != null) return advanceSequence(session, segments);
  const left = minutesToBlockEnd(session);
  if (left !== null && left < MIN_TRIMMED_FOCUS_MIN) {
    return endBlock(session);
  }

  return {
    ...session,
    state: 'FOCUS',
    startedAt: new Date().toISOString(),
  };
}

/** The next segment after the running one, or the one the clock is already in if that's later. */
function advanceSequence(session: PomodoroSession, segments: TimedSegment[]): PomodoroSession {
  const byClock = segmentIndexAt(segments, segmentOffsetMin(session, Date.now()));
  const next = Math.max((session.segmentIndex ?? -1) + 1, byClock < 0 ? segments.length : byClock);
  return enterSegment(session, segments, next);
}

/**
 * "Cortar tramo" (regla de rescate): the running focus segment ends now and the next pause starts
 * early. The pause still ends at its own time, so nothing after it moves -- including the block's
 * end. The cut focus counts as a pomodoro (it was worked) and as a cut.
 */
function cutSegment(session: PomodoroSession): PomodoroSession {
  if (!canCutSegment(session)) return session;
  const next = sessionSegments(session)![session.segmentIndex! + 1];
  return {
    ...session,
    state: stateForSegment(next),
    segmentIndex: next.index,
    startedAt: new Date().toISOString(),
    completedCycles: session.completedCycles + 1,
    cutCount: (session.cutCount ?? 0) + 1,
  };
}

/** The block reached its end: a clean finish, not an interruption. */
function endBlock(session: PomodoroSession): PomodoroSession {
  return { ...session, state: 'IDLE', active: false, interrupted: false, endedAt: new Date().toISOString() };
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
    pausedAt: null,
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
  return session.active && session.state === 'FOCUS' && !session.pausedAt;
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
  // A paused session isn't running late, it's stopped on purpose.
  if (!session.active || !session.startedAt || session.pausedAt) {
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
