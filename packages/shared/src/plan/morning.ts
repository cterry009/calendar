// The flexible morning (dynamic-study-blocks, decided by the user 2026-10-22): the morning study
// blocks are a window, 08:00-12:00, in which the user aims for two blocks that start when they start
// them. At each start a check-in (motivation and concentration, 1-5) proposes the block's length and
// its focus length from a fixed table -- like attention/profiles.ts, code decides the minutes, never a
// model. A block counts by the focus actually done, not by reaching an end time.

import { MAX_BLOCK_REMINDERS } from '../planning/study.js';
import type { SequenceSegment } from './sequence.js';

export const MORNING_WINDOW = { startMinute: 8 * 60, endMinute: 12 * 60 } as const;
/** Blocks the morning aims for; more are allowed (design D3, open question 5). */
export const MORNING_BLOCK_TARGET = 2;
/** A block with at least this much real focus counts as done (D13). */
export const BLOCK_DONE_FOCUS_MIN = 60;

export const BLOCK_MIN_MIN = 90;
export const BLOCK_MIN_MAX = 150;
export const BLOCK_MIN_STEP = 15;
export const FOCUS_MIN_MIN = 20;
export const FOCUS_MIN_MAX = 40;
export const FOCUS_MIN_STEP = 5;
export const CLOSING_MIN = 15;

export const CHECK_IN_SCALE = [1, 2, 3, 4, 5] as const;

export interface BlockProposal {
  blockMin: number;
  focusMin: number;
}

/** Energy E = the average of motivation and concentration, rounded (2.5 -> 3). */
export function energyOf(motivation: number, concentration: number): number {
  const clamp = (n: number) => Math.min(5, Math.max(1, Math.round(n)));
  return Math.round((clamp(motivation) + clamp(concentration)) / 2);
}

// The user's starting table (2026-10-22); the check-ins are logged so it can be calibrated later.
export function proposalForEnergy(energy: number): BlockProposal {
  if (energy <= 2) return { blockMin: 90, focusMin: 20 };
  if (energy === 3) return { blockMin: 120, focusMin: 30 };
  return { blockMin: 150, focusMin: 40 };
}

export function checkInProposal(
  motivation: number,
  concentration: number,
): BlockProposal & { energy: number } {
  const energy = energyOf(motivation, concentration);
  return { energy, ...proposalForEnergy(energy) };
}

function clampStep(value: number, min: number, max: number, step: number): number {
  const rounded = Math.round(value / step) * step;
  return Math.min(max, Math.max(min, rounded));
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

// The old morning sequence's intent, kept as labels (horario 2026-10-19).
const FIRST_FOCUS = 'P1 · arranque: meta de la sesión en una línea + leer la sección';
const DEEP_FOCUS = 'profundo: rehacer derivaciones a mano o ejercicios 🟡';
const LAST_FOCUS = 'corto: ejercicios 🟢';
export const CLOSING_LABEL =
  'Cierre: recuerdo activo, marcar avance en el PENSUM, primera tarea de la próxima sesión';

/**
 * A flexible block's plan (D6): focus and its pause while a pair still fits with the closing, then a
 * last focus with what's left (dropped under 20 minutes), then the 15-minute closing. It's a guide:
 * focus starts are manual, so the real block can run longer.
 */
export function planFlexibleBlock(blockMin: number, focusMin: number): SequenceSegment[] {
  const block = clampBlockMin(blockMin);
  const focus = clampFocusMin(focusMin);
  const focuses: number[] = [];
  let t = 0;
  while (t + focus + pauseAfterFocus(focus) + CLOSING_MIN <= block) {
    focuses.push(focus);
    t += focus + pauseAfterFocus(focus);
  }
  const left = block - t - CLOSING_MIN;
  let last = Math.floor((left - 5) / FOCUS_MIN_STEP) * FOCUS_MIN_STEP;
  if (last + pauseAfterFocus(last) > left) last -= FOCUS_MIN_STEP;
  if (last >= FOCUS_MIN_MIN) focuses.push(Math.min(last, FOCUS_MIN_MAX));

  const segments: SequenceSegment[] = [];
  focuses.forEach((minutes, i) => {
    const label =
      i === 0
        ? FIRST_FOCUS
        : i === focuses.length - 1 && focuses.length >= 3
          ? `P${i + 1} · ${LAST_FOCUS}`
          : `P${i + 1} · ${DEEP_FOCUS}`;
    segments.push({ tipo: 'foco', minutos: minutes, etiqueta: label });
    segments.push({ tipo: 'pausa', minutos: pauseAfterFocus(minutes), etiqueta: 'Pausa' });
  });
  segments.push({ tipo: 'cierre', minutos: CLOSING_MIN, etiqueta: CLOSING_LABEL });
  return segments;
}

/** Planned focus minutes of a plan (pomodoros only, not the closing). */
export function plannedFocusMinutes(sequence: SequenceSegment[]): number {
  return sequence.filter((s) => s.tipo === 'foco').reduce((sum, s) => sum + s.minutos, 0);
}

// ─── Completion ──────────────────────────────────────────────────────────────

export interface FlexibleSessionLike {
  id?: string;
  flexible?: boolean | null;
  active?: boolean;
  blockStartAt?: string | null;
  endedAt?: string | null;
  focusMinutes?: number | null;
  scheduleId?: string | null;
}

export function blockDone(session: Pick<FlexibleSessionLike, 'focusMinutes'>): boolean {
  return (session.focusMinutes ?? 0) >= BLOCK_DONE_FOCUS_MIN;
}

function localKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

export interface MorningStatus {
  started: number;
  done: number;
  target: number;
  fulfilled: boolean;
  /** Each started block: its real focus and whether it counts. */
  blocks: Array<{ id?: string; focusMinutes: number; done: boolean; active: boolean }>;
}

export function morningStatus(sessions: FlexibleSessionLike[], dateKey: string): MorningStatus {
  const today = flexibleSessionsOn(sessions, dateKey);
  const blocks = today.map((s) => ({
    id: s.id,
    focusMinutes: s.focusMinutes ?? 0,
    done: blockDone(s),
    active: !!s.active,
  }));
  const done = blocks.filter((b) => b.done).length;
  return {
    started: blocks.length,
    done,
    target: MORNING_BLOCK_TARGET,
    fulfilled: done >= MORNING_BLOCK_TARGET,
    blocks,
  };
}

// ─── Reminders ───────────────────────────────────────────────────────────────

/** Minutes after the window opens for the two "start your first block" reminders. */
export const START_REMINDER_OFFSETS_MIN = [20, 50] as const;
/** Minutes after a block ends before reminding to start the next one. */
export const BETWEEN_REMINDER_MIN = 20;

export interface MorningReminder {
  /** Stable per morning: 'start-1', 'start-2', 'between-1', ... */
  id: string;
  title: string;
  body: string;
}

/**
 * The reminder to show now, if any (D15): soft, never after the window's end or once the morning is
 * fulfilled, and at most MAX_BLOCK_REMINDERS per morning. `sent` are the ids already shown today.
 */
export function dueMorningReminder(input: {
  now: Date;
  window?: { startMinute: number; endMinute: number };
  /** That day's sessions (any; only flexible ones count). */
  sessions: FlexibleSessionLike[];
  sent: readonly string[];
}): MorningReminder | null {
  const window = input.window ?? MORNING_WINDOW;
  if (input.sent.length >= MAX_BLOCK_REMINDERS) return null;
  const minute = input.now.getHours() * 60 + input.now.getMinutes();
  if (minute < window.startMinute || minute >= window.endMinute) return null;
  const dateKey = localKey(input.now.toISOString());
  const today = flexibleSessionsOn(input.sessions, dateKey);
  if (today.some((s) => s.active)) return null;
  const status = morningStatus(input.sessions, dateKey);
  if (status.fulfilled) return null;

  if (today.length === 0) {
    const [first, second] = START_REMINDER_OFFSETS_MIN;
    // Opened late: only the latest reminder that's due, so an earlier one doesn't follow it.
    if (minute >= window.startMinute + second) {
      return input.sent.includes('start-2')
        ? null
        : {
            id: 'start-2',
            title: 'Bloque de estudio',
            body: 'Todavía no empiezas el primer bloque de la mañana.',
          };
    }
    if (minute >= window.startMinute + first && !input.sent.includes('start-1')) {
      return {
        id: 'start-1',
        title: 'Bloque de estudio',
        body: 'Cuando quieras, empieza el primer bloque de la mañana.',
      };
    }
    return null;
  }

  const last = today[today.length - 1];
  if (!last.endedAt) return null;
  const id = `between-${today.length}`;
  if (input.sent.includes(id)) return null;
  const since = (input.now.getTime() - new Date(last.endedAt).getTime()) / 60_000;
  if (since < BETWEEN_REMINDER_MIN) return null;
  return {
    id,
    title: 'Bloque de estudio',
    body: `Llevas ${Math.round(since)} min de pausa: ¿empiezas el bloque ${today.length + 1}?`,
  };
}
