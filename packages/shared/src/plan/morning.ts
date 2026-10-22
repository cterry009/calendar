// The flexible weekday (dynamic-study-blocks; revision 2 decided by the user 2026-10-22): Monday to
// Friday is two windows, 09:00-13:00 and 14:00-18:00, each with two suggested blocks that start when the
// user starts them. A diagnosis before every pomodoro (motivation and concentration, 0-100) and the
// rating after it (0-100) size the block (60-120 min) and each focus (20-40) -- like
// attention/profiles.ts, code decides the minutes, never a model. A block counts by the focus actually
// done, not by reaching an end time.

import { HORARIO_2026 } from './horario.js';
import type { SequenceSegment } from './sequence.js';

function clock(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

export type DayWindowName = 'manana' | 'tarde';

export interface DayWindowSpan {
  name: DayWindowName;
  startMinute: number;
  endMinute: number;
}

/** 09:00-13:00 and 14:00-18:00 (horario.ts bloques_dinamicos). */
export const DAY_WINDOWS: DayWindowSpan[] = HORARIO_2026.bloques_dinamicos.ventanas_lun_vie.map(
  (w) => ({
    name: w.nombre,
    startMinute: clock(w.inicio),
    endMinute: clock(w.fin),
  }),
);

/** The window a minute of the day falls in, if any. */
export function windowForMinute(minute: number): DayWindowSpan | null {
  return DAY_WINDOWS.find((w) => minute >= w.startMinute && minute < w.endMinute) ?? null;
}

/** The day's minimum: two done blocks of the morning window. */
export const MORNING_BLOCK_TARGET = 2;
/** A block with at least this much real focus counts as done (D27). */
export const BLOCK_DONE_FOCUS_MIN = 45;

export const BLOCK_MIN_MIN = 60;
export const BLOCK_MIN_MAX = 120;
export const BLOCK_MIN_STEP = 10;
export const FOCUS_MIN_MIN = 20;
export const FOCUS_MIN_MAX = 40;
export const FOCUS_MIN_STEP = 5;
export const CLOSING_MIN = 15;

// ─── Diagnosis and rating, 0-100 (D22) ───────────────────────────────────────

export const SCALE_MIN = 0;
export const SCALE_MAX = 100;
export const SCALE_STEP = 5;
/** Under this: low. */
export const BAND_LOW_BELOW = 45;
/** From this: high. */
export const BAND_HIGH_FROM = 70;

export type EnergyBand = 'baja' | 'media' | 'alta';
export const BAND_LABELS: Record<EnergyBand, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
};

export function clampScale(value: number): number {
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round(value / SCALE_STEP) * SCALE_STEP));
}

/** The band of a 0-100 value: low under 45, medium 45-69, high from 70. */
export function bandOf(value: number): EnergyBand {
  if (value < BAND_LOW_BELOW) return 'baja';
  return value >= BAND_HIGH_FROM ? 'alta' : 'media';
}

export function diagnosisBand(motivation: number, concentration: number): EnergyBand {
  return bandOf((clampScale(motivation) + clampScale(concentration)) / 2);
}

/** A 1-5 rating from before 2026-10-22, on the 0-100 scale: (r − 1) × 25. */
export function ratingTo100(rating: number, scale?: unknown): number {
  return scale === '0-100' ? rating : Math.round((rating - 1) * 25);
}

// ─── Lengths (D23) ───────────────────────────────────────────────────────────

const BLOCK_FOR_BAND: Record<EnergyBand, number> = { baja: 60, media: 90, alta: 120 };
const FOCUS_FOR_BAND: Record<EnergyBand, number> = { baja: 20, media: 30, alta: 40 };

export function blockMinFor(band: EnergyBand): number {
  return BLOCK_FOR_BAND[band];
}

export function focusMinFor(band: EnergyBand): number {
  return FOCUS_FOR_BAND[band];
}

export interface DiagnosisProposal {
  band: EnergyBand;
  average: number;
  blockMin: number;
  focusMin: number;
}

/** What a diagnosis proposes: the block's length (used at its start) and the focus's. */
export function diagnosisProposal(motivation: number, concentration: number): DiagnosisProposal {
  const average = (clampScale(motivation) + clampScale(concentration)) / 2;
  const band = bandOf(average);
  return { band, average, blockMin: blockMinFor(band), focusMin: focusMinFor(band) };
}

function clampStep(value: number, min: number, max: number, step: number): number {
  return Math.min(max, Math.max(min, Math.round(value / step) * step));
}

export function clampBlockMin(minutes: number): number {
  return clampStep(minutes, BLOCK_MIN_MIN, BLOCK_MIN_MAX, BLOCK_MIN_STEP);
}

export function clampFocusMin(minutes: number): number {
  return clampStep(minutes, FOCUS_MIN_MIN, FOCUS_MIN_MAX, FOCUS_MIN_STEP);
}

/** 5 minutes after a focus under 40, 10 after a 40. */
export function pauseAfterFocus(focusMin: number): number {
  return focusMin >= 40 ? 10 : 5;
}

// ─── The ±10 rule (D24) ──────────────────────────────────────────────────────

/** The planned block can't go under what was already worked, rounded up to 10. */
export function minPlannedFor(workedMin: number): number {
  return Math.max(
    BLOCK_MIN_MIN,
    Math.ceil(Math.max(0, workedMin) / BLOCK_MIN_STEP) * BLOCK_MIN_STEP,
  );
}

export interface PlannedBlockAdjustment {
  planned: number;
  delta: number;
  /** Spanish, for the user: why it moved. */
  reason: string;
}

/**
 * Before each focus after the first: +10 if the last pomodoro's rating and the new diagnosis are both
 * high; −10 if either is low or the last focus was cut; otherwise the same. Always within 60-120 and
 * never under the minutes already worked. A rating that wasn't given counts as no signal.
 */
export function adjustPlannedBlock(input: {
  planned: number;
  /** The last pomodoro's rating, 0-100; null when the card was dismissed. */
  lastRating: number | null;
  band: EnergyBand;
  lastCut: boolean;
  workedMin: number;
}): PlannedBlockAdjustment {
  const ratingBand = input.lastRating === null ? null : bandOf(input.lastRating);
  let delta = 0;
  let reason = 'Sin cambio';
  if (input.lastCut || ratingBand === 'baja' || input.band === 'baja') {
    delta = -BLOCK_MIN_STEP;
    reason = input.lastCut ? 'Cortaste el tramo: −10 min' : 'Energía baja: −10 min';
  } else if (ratingBand === 'alta' && input.band === 'alta') {
    delta = BLOCK_MIN_STEP;
    reason = 'Pomodoro y diagnóstico altos: +10 min';
  }
  // Past 120 min of work the floor wins over the ceiling: the block can't end before what was done.
  const planned = Math.max(minPlannedFor(input.workedMin), clampBlockMin(input.planned + delta));
  if (delta !== 0 && planned === input.planned) reason += ' (ya en el límite)';
  return { planned, delta: planned - input.planned, reason };
}

/**
 * The longest focus (20-40, steps of 5) that still fits the planned block with its pause and the
 * closing, `elapsedMin` into it; null when even 20 doesn't: then the closing comes next (D25).
 */
export function maxFittingFocus(plannedMin: number, elapsedMin: number): number | null {
  const left = plannedMin - elapsedMin - CLOSING_MIN;
  for (let focus = FOCUS_MIN_MAX; focus >= FOCUS_MIN_MIN; focus -= FOCUS_MIN_STEP) {
    if (focus + pauseAfterFocus(focus) <= left) return focus;
  }
  return null;
}

// ─── Labels (D29) ────────────────────────────────────────────────────────────

const FIRST_FOCUS = 'P1 · arranque: meta de la sesión en una línea + leer la sección';
const DEEP_FOCUS = 'profundo: rehacer derivaciones a mano o ejercicios 🟡';
export const CLOSING_LABEL =
  'Cierre: recuerdo activo, marcar avance en el PENSUM, primera tarea de la próxima sesión';
/** Appended to a focus's label when "cortar tramo" ended it: the rule reads it as low energy. */
export const CUT_MARK = ' · cortado';

/**
 * The n-th focus's label (1-based): the category's suggested pomodoros in order (afternoon), else the
 * study block's intent (P1 arranque, then profundo).
 */
export function focusLabel(n: number, suggestions?: string[]): string {
  if (suggestions?.length) return suggestions[n - 1] ?? `Pomodoro ${n}`;
  return n === 1 ? FIRST_FOCUS : `P${n} · ${DEEP_FOCUS}`;
}

/** Planned focus minutes of a plan (pomodoros only, not the closing). */
export function plannedFocusMinutes(sequence: SequenceSegment[]): number {
  return sequence.filter((s) => s.tipo === 'foco').reduce((sum, s) => sum + s.minutos, 0);
}

// ─── Completion (D27) ────────────────────────────────────────────────────────

export interface FlexibleSessionLike {
  id?: string;
  flexible?: boolean | null;
  active?: boolean;
  scheduleId?: string | null;
  blockStartAt?: string | null;
  windowEndAt?: string | null;
  endedAt?: string | null;
  focusMinutes?: number | null;
}

export function blockDone(session: Pick<FlexibleSessionLike, 'focusMinutes'>): boolean {
  return (session.focusMinutes ?? 0) >= BLOCK_DONE_FOCUS_MIN;
}

function localKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function minuteOf(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

/** The window a flexible session belongs to: by its window's end, else by when it started. */
export function sessionWindow(session: FlexibleSessionLike): DayWindowName | null {
  if (session.windowEndAt) {
    const end = minuteOf(session.windowEndAt);
    const byEnd = DAY_WINDOWS.find((w) => w.endMinute === end);
    if (byEnd) return byEnd.name;
  }
  return session.blockStartAt
    ? (windowForMinute(minuteOf(session.blockStartAt))?.name ?? null)
    : null;
}

/** The flexible block sessions started on a local day, in start order. */
export function flexibleSessionsOn<S extends FlexibleSessionLike>(
  sessions: S[],
  dateKey: string,
): S[] {
  return sessions
    .filter((s) => s.flexible && s.blockStartAt && localKey(s.blockStartAt) === dateKey)
    .sort((a, b) => a.blockStartAt!.localeCompare(b.blockStartAt!));
}

export interface WindowStatus {
  started: number;
  done: number;
  /** Each started block: its real focus and whether it counts. */
  blocks: Array<{
    id?: string;
    scheduleId?: string | null;
    focusMinutes: number;
    done: boolean;
    active: boolean;
  }>;
}

export interface MorningStatus extends WindowStatus {
  target: number;
  fulfilled: boolean;
}

function windowStatus(sessions: FlexibleSessionLike[]): WindowStatus {
  const blocks = sessions.map((s) => ({
    id: s.id,
    scheduleId: s.scheduleId ?? null,
    focusMinutes: s.focusMinutes ?? 0,
    done: blockDone(s),
    active: !!s.active,
  }));
  return { started: blocks.length, done: blocks.filter((b) => b.done).length, blocks };
}

/** The morning's blocks that day and whether the day's minimum (two done) is met. */
export function morningStatus(sessions: FlexibleSessionLike[], dateKey: string): MorningStatus {
  const status = windowStatus(
    flexibleSessionsOn(sessions, dateKey).filter((s) => sessionWindow(s) !== 'tarde'),
  );
  return {
    ...status,
    target: MORNING_BLOCK_TARGET,
    fulfilled: status.done >= MORNING_BLOCK_TARGET,
  };
}

/** The afternoon's blocks that day (no minimum). */
export function afternoonStatus(sessions: FlexibleSessionLike[], dateKey: string): WindowStatus {
  return windowStatus(
    flexibleSessionsOn(sessions, dateKey).filter((s) => sessionWindow(s) === 'tarde'),
  );
}

// ─── Reminders (D28) ─────────────────────────────────────────────────────────

export interface SuggestedBlock {
  scheduleId: string;
  startMinute: number;
  label: string | null;
}

export interface BlockReminder {
  /** The suggestion's schedule: one reminder per suggestion and day. */
  id: string;
  scheduleId: string;
  title: string;
  body: string;
}

/**
 * The reminder to show now, if any: a suggestion is due from its time until the next suggestion of its
 * window (or the window's end), when nothing is running and it hasn't been started that day; each one
 * only once (`sent` holds the ids already shown today).
 */
export function dueBlockReminder(input: {
  now: Date;
  /** Today's suggestions (the day's flexible schedules). */
  suggestions: SuggestedBlock[];
  /** Sessions of any day; only today's flexible ones count. */
  sessions: FlexibleSessionLike[];
  sent: readonly string[];
}): BlockReminder | null {
  const minute = input.now.getHours() * 60 + input.now.getMinutes();
  const dateKey = localKey(input.now.toISOString());
  const today = flexibleSessionsOn(input.sessions, dateKey);
  if (today.some((s) => s.active)) return null;
  const sorted = [...input.suggestions].sort((a, b) => a.startMinute - b.startMinute);
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    const window = windowForMinute(s.startMinute);
    if (!window) continue;
    const next = sorted.slice(i + 1).find((o) => o.startMinute < window.endMinute);
    const until = next ? next.startMinute : window.endMinute;
    if (minute < s.startMinute || minute >= until) continue;
    if (input.sent.includes(s.scheduleId) || today.some((t) => t.scheduleId === s.scheduleId))
      return null;
    const hh = `${String(Math.floor(s.startMinute / 60)).padStart(2, '0')}:${String(s.startMinute % 60).padStart(2, '0')}`;
    return {
      id: s.scheduleId,
      scheduleId: s.scheduleId,
      title: s.label ?? 'Bloque sugerido',
      body: `Bloque sugerido de las ${hh}: empiézalo cuando quieras.`,
    };
  }
  return null;
}
