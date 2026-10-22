import type { PomodoroConfig, PomodoroSession } from '../schemas/pomodoro.js';
import type { PomodoroState } from '../schemas/enums.js';
import {
  ATTENTION_PROFILE_SPECS,
  MIN_TRIMMED_FOCUS_MIN,
  type AttentionProfile,
} from '../attention/profiles.js';
import {
  fitSequence,
  isWorkSegment,
  segmentIndexAt,
  type SequenceSegment,
  type TimedSegment,
} from '../plan/sequence.js';
import {
  BLOCK_MIN_MAX,
  CLOSING_LABEL,
  CLOSING_MIN,
  CUT_MARK,
  clampBlockMin,
  clampFocusMin,
  focusLabel,
  maxFittingFocus,
  minPlannedFor,
  pauseAfterFocus,
} from '../plan/morning.js';

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
  | { type: 'CUT_SEGMENT' }
  // Flexible block (2026-10-22): start the next focus (or the closing) by hand, with its minutes, the
  // planned block after the ±10 rule, and the focus's label.
  | {
      type: 'START_FOCUS';
      minutes?: number;
      plannedBlockMin?: number;
      closing?: boolean;
      label?: string;
    }
  // Flexible block: "Terminar bloque", a clean end (not "Salir").
  | { type: 'END_BLOCK' };

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
    ...createPomodoroSession(id, {
      focusDurationMin: focusMin,
      shortBreakMin: breakMin,
      longBreakMin: breakMin,
      cyclesBeforeLongBreak: 4,
    }),
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
  const focusMin =
    sequence.find((s) => s.tipo === 'foco')?.minutos ?? DEFAULT_POMODORO_CONFIG.focusDurationMin;
  const breakMin =
    sequence.find((s) => s.tipo === 'pausa')?.minutos ?? DEFAULT_POMODORO_CONFIG.shortBreakMin;
  return {
    ...createPomodoroSession(id, {
      focusDurationMin: focusMin,
      shortBreakMin: breakMin,
      longBreakMin: breakMin,
      cyclesBeforeLongBreak: 4,
    }),
    blockStartAt,
    blockEndAt,
    sequence: sequence.map(({ tipo, minutos, etiqueta }) => ({ tipo, minutos, etiqueta })),
    segmentIndex: null,
    cutCount: 0,
    attentionProfile: profile,
  };
}

/**
 * A flexible block (dynamic-study-blocks D4, D25): started now with its first focus, from the first
 * diagnosis's lengths; nothing is read from the clock, so starting late loses nothing. No blockEndAt:
 * older clients see no clock-anchored sequence they could misplace. windowEndAt (its window's end) stops
 * new focuses (D11); a block started outside the windows has none.
 */
export function createFlexibleBlockSession(
  id: string,
  options: {
    profile?: AttentionProfile;
    blockMin: number;
    focusMin: number;
    windowEndAt: string | null;
    /** The first focus's label; the study block's "P1 arranque" by default. */
    label?: string;
    /** Default now. */
    startAt?: string;
  },
): PomodoroSession {
  const startAt = options.startAt ?? new Date().toISOString();
  const focusMin = clampFocusMin(options.focusMin);
  return {
    ...createPomodoroSession(id, {
      focusDurationMin: focusMin,
      shortBreakMin: pauseAfterFocus(focusMin),
      longBreakMin: pauseAfterFocus(focusMin),
      cyclesBeforeLongBreak: 4,
    }),
    flexible: true,
    blockStartAt: startAt,
    blockEndAt: null,
    windowEndAt: options.windowEndAt && options.windowEndAt > startAt ? options.windowEndAt : null,
    plannedBlockMin: clampBlockMin(options.blockMin),
    sequence: [
      { tipo: 'foco', minutos: focusMin, etiqueta: options.label ?? focusLabel(1) },
      { tipo: 'pausa', minutos: pauseAfterFocus(focusMin), etiqueta: 'Pausa' },
    ],
    segmentIndex: null,
    cutCount: 0,
    focusMinutes: 0,
    attentionProfile: options.profile ?? 'DEEP',
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

/** A flexible block's plan with planned offsets from its start (for drawing; nothing runs on them). */
export function flexibleSegments(session: Pick<PomodoroSession, 'sequence'>): TimedSegment[] {
  let t = 0;
  return (session.sequence ?? []).map((segment, index) => {
    const timed = {
      ...segment,
      index,
      startOffset: t,
      endOffset: t + segment.minutos,
      trimmed: false,
    };
    t += segment.minutos;
    return timed;
  });
}

/** The running segment of a sequence session, if any. */
export function currentSegment(
  session: SequenceFields & Pick<PomodoroSession, 'segmentIndex'> & { flexible?: boolean | null },
): TimedSegment | null {
  if (session.flexible) {
    if (session.segmentIndex == null) return null;
    return flexibleSegments(session)[session.segmentIndex] ?? null;
  }
  const segments = sessionSegments(session);
  if (!segments || session.segmentIndex == null) return null;
  return segments[session.segmentIndex] ?? null;
}

/** "Cortar tramo" is offered: a focus segment is running and a pause follows it. */
export function canCutSegment(session: PomodoroSession): boolean {
  if (!session.active || session.pausedAt || session.state !== 'FOCUS') return false;
  if (session.flexible) return currentSegment(session)?.tipo === 'foco';
  const segments = sessionSegments(session);
  if (!segments || session.segmentIndex == null) return false;
  return (
    segments[session.segmentIndex]?.tipo === 'foco' &&
    segments[session.segmentIndex + 1]?.tipo === 'pausa'
  );
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
function enterSegment(
  session: PomodoroSession,
  segments: TimedSegment[],
  index: number,
): PomodoroSession {
  const now = Date.now();
  // Skip segments already over (the device was asleep) or with under a minute left.
  let i = index;
  while (i < segments.length && segmentEndMs(session, segments[i]) - now < 60_000) i++;
  if (i >= segments.length) return endBlock(session);
  return {
    ...session,
    state: stateForSegment(segments[i]),
    segmentIndex: i,
    startedAt: new Date(now).toISOString(),
  };
}

/** Minutes from `from` (ISO, default now) to the block's end; null outside block mode. */
export function minutesToBlockEnd(
  session: Pick<PomodoroSession, 'blockEndAt'>,
  from: number = Date.now(),
): number | null {
  if (!session.blockEndAt) return null;
  const end = new Date(session.blockEndAt).getTime();
  return Number.isNaN(end) ? null : (end - from) / 60_000;
}

export function getPhaseDurationMinutes(session: PomodoroSession): number | null {
  const base =
    session.state === 'FOCUS'
      ? session.focusDurationMin
      : session.state === 'SHORT_BREAK'
        ? session.shortBreakMin
        : session.state === 'LONG_BREAK'
          ? session.longBreakMin
          : null;
  if (base === null || !session.startedAt) return base;
  // A flexible block's phase is its own minutes: no clock anchor and no fixed end.
  if (session.flexible) return base;
  // Sequence mode: the running segment ends at its fixed clock time.
  const segment = currentSegment(session);
  if (segment) {
    return Math.max(
      0,
      (segmentEndMs(session, segment) - new Date(session.startedAt).getTime()) / 60_000,
    );
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
      return session.flexible ? cutFlexibleFocus(session) : cutSegment(session);
    case 'START_FOCUS':
      return startFlexibleFocus(session, event);
    case 'END_BLOCK':
      return endFlexibleBlock(session);
    default:
      return session;
  }
}

function startFocus(session: PomodoroSession, taskId?: string | null): PomodoroSession {
  if (session.state !== 'IDLE' || session.active) {
    return session;
  }
  if (session.flexible) {
    // Starting the block starts its first focus, from now.
    const started = {
      ...session,
      active: true,
      interrupted: false,
      taskId: taskId ?? null,
      endedAt: null,
    };
    return enterFlexibleWork(started, 0);
  }
  const segments = sessionSegments(session);
  if (segments) {
    // Sequence mode: join the segment running now; inside a pause, start the next focus early.
    let index = segmentIndexAt(segments, segmentOffsetMin(session, Date.now()));
    if (index < 0) return session;
    while (index < segments.length && !isWorkSegment(segments[index])) index++;
    if (index >= segments.length) return session;
    const started = enterSegment(
      { ...session, active: true, interrupted: false, taskId: taskId ?? null, endedAt: null },
      segments,
      index,
    );
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
    return enterSegment(
      { ...session, pausedAt: null },
      segments,
      index < 0 ? segments.length : index,
    );
  }
  const left = minutesToBlockEnd(session);
  if (left !== null && left < MIN_TRIMMED_FOCUS_MIN)
    return endBlock({ ...session, pausedAt: null });
  const pausedMs = Date.now() - new Date(session.pausedAt).getTime();
  const startedAt = new Date(
    new Date(session.startedAt).getTime() + Math.max(0, pausedMs),
  ).toISOString();
  return { ...session, startedAt, pausedAt: null };
}

/** The moment time is measured at: now, or when the session was paused. */
export function sessionClock(
  session: Pick<PomodoroSession, 'pausedAt'>,
  now: number = Date.now(),
): number {
  if (!session.pausedAt) return now;
  const paused = new Date(session.pausedAt).getTime();
  return Number.isNaN(paused) ? now : Math.min(now, paused);
}

function completeFocus(session: PomodoroSession): PomodoroSession {
  if (session.pausedAt) return session;
  if (session.state !== 'FOCUS') {
    return session;
  }
  if (session.flexible) return completeFlexibleWork(session, session.focusDurationMin);

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
    return {
      ...session,
      state: 'SHORT_BREAK',
      completedCycles: nextCompletedCycles,
      startedAt: new Date().toISOString(),
    };
  }
  const nextState: PomodoroState =
    nextCompletedCycles % session.cyclesBeforeLongBreak === 0 ? 'LONG_BREAK' : 'SHORT_BREAK';

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
  // Pause automatic, focus manual (D5): a flexible pause that's over just waits for START_FOCUS.
  if (session.flexible) return session;
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

// ─── Flexible blocks (dynamic-study-blocks, revision 2, 2026-10-22) ─────────
// The plan is a budget (D25): `plannedBlockMin` is the block's planned length, and the sequence grows
// one focus (with its pause) at a time, each one sized by its own diagnosis. The ±10 rule (D24) is
// computed by the caller from the diagnosis and the last rating, and arrives as START_FOCUS's
// `plannedBlockMin`.

/** Whether the window is over for this session at `now`: no new focus then (D11). */
function windowOver(session: Pick<PomodoroSession, 'windowEndAt'>, now: number): boolean {
  if (!session.windowEndAt) return false;
  const end = new Date(session.windowEndAt).getTime();
  return !Number.isNaN(end) && now >= end;
}

/** Minutes since the block started (time out with "Salir" doesn't count). */
export function elapsedBlockMinutes(
  session: Pick<PomodoroSession, 'blockStartAt' | 'pausedAt'>,
  now: number = Date.now(),
): number {
  if (!session.blockStartAt) return 0;
  return Math.max(
    0,
    (sessionClock(session, now) - new Date(session.blockStartAt).getTime()) / 60_000,
  );
}

/** Whether the last focus of a flexible block ended with "cortar tramo" (a low-energy signal, D24). */
export function lastFocusWasCut(session: Pick<PomodoroSession, 'sequence'>): boolean {
  const last = [...(session.sequence ?? [])].reverse().find((s) => s.tipo === 'foco');
  return !!last?.etiqueta.endsWith(CUT_MARK);
}

export interface NextFlexibleWork {
  tipo: 'foco' | 'cierre';
  /** The longest focus that still fits the planned block (20-40); the closing's 15. */
  minutes: number;
  /** The window is over: only the closing is offered. */
  closingOnly: boolean;
  /** Focuses already done in the block (the next one is number done + 1). */
  focusesDone: number;
}

/**
 * What comes after the running pause, with the block planned as it is now: a focus while one of at
 * least 20 still fits with its pause and the closing, else the closing -- also after the window's end.
 * Null when nothing is left, or when a work segment is running.
 */
export function nextFlexibleWork(
  session: PomodoroSession,
  now: number = Date.now(),
  plannedBlockMin?: number,
): NextFlexibleWork | null {
  if (!session.flexible || !session.active || session.state === 'FOCUS') return null;
  const plan = session.sequence ?? [];
  if (plan.at(-1)?.tipo === 'cierre') return null;
  const focusesDone = plan.filter((s) => s.tipo === 'foco').length;
  if (windowOver(session, now))
    return { tipo: 'cierre', minutes: CLOSING_MIN, closingOnly: true, focusesDone };
  const fit = maxFittingFocus(
    plannedBlockMin ?? session.plannedBlockMin ?? BLOCK_MIN_MAX,
    elapsedBlockMinutes(session, now),
  );
  return fit === null
    ? { tipo: 'cierre', minutes: CLOSING_MIN, closingOnly: false, focusesDone }
    : { tipo: 'foco', minutes: fit, closingOnly: false, focusesDone };
}

/** Minutes a flexible pause has run past its length (0 while it's on time). */
export function pauseOverrunMinutes(session: PomodoroSession, now: number = Date.now()): number {
  if (!session.flexible || !session.active || session.pausedAt || !session.startedAt) return 0;
  if (session.state !== 'SHORT_BREAK' && session.state !== 'LONG_BREAK') return 0;
  const over =
    (now - new Date(session.startedAt).getTime()) / 60_000 -
    (getPhaseDurationMinutes(session) ?? 0);
  return Math.max(0, over);
}

/** Runs work segment `index` (a focus or the closing) from now. */
function enterFlexibleWork(session: PomodoroSession, index: number): PomodoroSession {
  const segment = session.sequence?.[index];
  if (!segment || segment.tipo === 'pausa') return session;
  return {
    ...session,
    state: 'FOCUS',
    segmentIndex: index,
    focusDurationMin: segment.minutos,
    startedAt: new Date().toISOString(),
  };
}

function startFlexibleFocus(
  session: PomodoroSession,
  event: { minutes?: number; plannedBlockMin?: number; closing?: boolean; label?: string },
): PomodoroSession {
  if (!session.flexible || !session.active || session.pausedAt || session.state === 'FOCUS')
    return session;
  const plan = [...(session.sequence ?? [])];
  if (plan.at(-1)?.tipo === 'cierre') return session;
  const now = Date.now();
  // The planned block after the rule (or the user's choice): 60-120 and never under what was worked.
  const planned = Math.max(
    minPlannedFor(elapsedBlockMinutes(session, now)),
    clampBlockMin(event.plannedBlockMin ?? session.plannedBlockMin ?? BLOCK_MIN_MAX),
  );
  const withPlan = { ...session, plannedBlockMin: planned };
  const next = nextFlexibleWork(withPlan, now);
  if (!next) return session;
  if (event.closing || next.tipo === 'cierre') {
    plan.push({ tipo: 'cierre', minutos: CLOSING_MIN, etiqueta: CLOSING_LABEL });
    return enterFlexibleWork({ ...withPlan, sequence: plan }, plan.length - 1);
  }
  // The user's length wins over what fits: the block can run past its plan if they say so.
  const minutes = clampFocusMin(event.minutes ?? next.minutes);
  plan.push({
    tipo: 'foco',
    minutos: minutes,
    etiqueta: event.label ?? focusLabel(next.focusesDone + 1),
  });
  plan.push({ tipo: 'pausa', minutos: pauseAfterFocus(minutes), etiqueta: 'Pausa' });
  return enterFlexibleWork({ ...withPlan, sequence: plan }, plan.length - 2);
}

/**
 * A work segment ended after `workedMin`: a focus counts as a pomodoro and its minutes go into
 * focusMinutes, then its pause starts by itself; the closing ends the block.
 */
function completeFlexibleWork(session: PomodoroSession, workedMin: number): PomodoroSession {
  const segment = currentSegment(session);
  if (!segment || segment.tipo === 'cierre') return endBlock(session);
  const pause = session.sequence?.[segment.index + 1];
  return {
    ...session,
    completedCycles: session.completedCycles + 1,
    focusMinutes: (session.focusMinutes ?? 0) + Math.max(0, Math.round(workedMin)),
    state: 'SHORT_BREAK',
    // Without a planned pause after it, it still waits in a short one: the next work is by hand.
    segmentIndex: pause?.tipo === 'pausa' ? segment.index + 1 : segment.index,
    shortBreakMin: pause?.tipo === 'pausa' ? pause.minutos : pauseAfterFocus(segment.minutos),
    startedAt: new Date().toISOString(),
  };
}

function workedMinutes(session: PomodoroSession, now: number): number {
  if (!session.startedAt) return 0;
  return Math.max(
    0,
    Math.floor((sessionClock(session, now) - new Date(session.startedAt).getTime()) / 60_000),
  );
}

/**
 * "Cortar tramo" in a flexible block (D10, D24): the focus ends now, counts with the minutes worked, its
 * pause starts, and it's marked as cut so the next focus lowers the planned block.
 */
function cutFlexibleFocus(session: PomodoroSession): PomodoroSession {
  if (!canCutSegment(session)) return session;
  const index = session.segmentIndex!;
  const plan = (session.sequence ?? []).map((segment, i) =>
    i === index && !segment.etiqueta.endsWith(CUT_MARK)
      ? { ...segment, etiqueta: `${segment.etiqueta}${CUT_MARK}` }
      : segment,
  );
  return completeFlexibleWork(
    { ...session, sequence: plan, cutCount: (session.cutCount ?? 0) + 1 },
    workedMinutes(session, Date.now()),
  );
}

/** "Terminar bloque": a running focus counts with its minutes, then a clean end. */
function endFlexibleBlock(session: PomodoroSession): PomodoroSession {
  if (!session.flexible || !session.active) return session;
  const segment = currentSegment(session);
  if (session.state === 'FOCUS' && segment?.tipo === 'foco') {
    const worked = workedMinutes(session, Date.now());
    return endBlock({
      ...session,
      pausedAt: null,
      completedCycles: session.completedCycles + (worked > 0 ? 1 : 0),
      focusMinutes: (session.focusMinutes ?? 0) + worked,
    });
  }
  return endBlock({ ...session, pausedAt: null });
}

/** The block reached its end: a clean finish, not an interruption. */
function endBlock(session: PomodoroSession): PomodoroSession {
  return {
    ...session,
    state: 'IDLE',
    active: false,
    interrupted: false,
    endedAt: new Date().toISOString(),
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
// A flexible block's pause waits for the user by design (D5): only an hour past its end is "abandoned".
export const ABANDONED_FLEXIBLE_PAUSE_GRACE_MS = 60 * 60 * 1000;

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
  const flexiblePause = session.flexible && session.state !== 'FOCUS';
  return overdueMs > (flexiblePause ? ABANDONED_FLEXIBLE_PAUSE_GRACE_MS : ABANDONED_PHASE_GRACE_MS);
}
