// 2026-11-10 (the user): how he is doing through the day, two ways.
// - Fixed: weekdays at 9, 11, 13, 15 and 17 (every two hours through the work day).
// - Dynamic: the desktop app compares what is happening with the plan and asks for a quantitative
//   report when they don't match. Decided on the device from data it already has: nothing polls the
//   server; only the answer is sent (one small POST).

export const FIXED_CHECKIN_HOURS = [9, 11, 13, 15, 17] as const;
/** A fixed check-in can be answered up to this long after its hour; later it's skipped, not stacked. */
export const FIXED_WINDOW_MIN = 50;
/** No two prompts closer than this. */
export const MIN_GAP_MIN = 45;
export const MAX_DYNAMIC_PER_DAY = 4;
/** A WORK block running this long with no focus started counts as "not doing it". */
export const IDLE_BLOCK_MIN = 20;
/** This many game minutes inside the last half hour of work time counts as off-plan. */
export const GAME_DRIFT_MIN = 15;

/** The fixed slot due now (its hour), or null. Weekdays only. */
export function dueFixedSlot(now: Date, answered: ReadonlySet<number>): number | null {
  const day = now.getDay();
  if (day === 0 || day === 6) return null;
  const minutes = now.getHours() * 60 + now.getMinutes();
  for (const h of FIXED_CHECKIN_HOURS) {
    if (answered.has(h)) continue;
    if (minutes >= h * 60 && minutes < h * 60 + FIXED_WINDOW_MIN) return h;
  }
  return null;
}

export interface DynamicSignals {
  /** Minutes since the current WORK block started, null outside one. */
  minutesIntoBlock: number | null;
  /** Whether any focus (pomodoro) ran in the current block. */
  focusedInBlock: boolean;
  /** Game minutes counted in the last 30 minutes of work time. */
  recentGameMinutes: number;
  /** Minutes since the last prompt of any kind, null if none today. */
  minutesSinceLastPrompt: number | null;
  dynamicPromptsToday: number;
  /** A pomodoro focus phase is running right now (never interrupt it). */
  inFocus: boolean;
}

export type DynamicReason = 'bloque-sin-foco' | 'juego-en-horario';

/** Why to ask now, or null. */
export function dynamicReason(s: DynamicSignals): DynamicReason | null {
  if (s.inFocus) return null;
  if (s.dynamicPromptsToday >= MAX_DYNAMIC_PER_DAY) return null;
  if (s.minutesSinceLastPrompt !== null && s.minutesSinceLastPrompt < MIN_GAP_MIN) return null;
  if (s.minutesIntoBlock !== null && s.minutesIntoBlock >= IDLE_BLOCK_MIN && !s.focusedInBlock) return 'bloque-sin-foco';
  if (s.recentGameMinutes >= GAME_DRIFT_MIN) return 'juego-en-horario';
  return null;
}

export const DYNAMIC_QUESTION: Record<DynamicReason, string> = {
  'bloque-sin-foco': 'El bloque empezó y no hay pomodoro. ¿Qué estás haciendo?',
  'juego-en-horario': 'Llevas un rato jugando en horario de trabajo. ¿Cómo vas?',
};

export const DYNAMIC_REASONS = ['Cansancio / sueño', 'Otra cosa urgente', 'No sé por dónde empezar', 'Recargando energía', 'Otro'] as const;
