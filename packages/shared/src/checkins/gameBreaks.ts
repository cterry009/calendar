// 2026-11-10 (the user): games as a way to recharge during the work day, in measure, and less every
// week (a gradual detox rather than a wall). In the weekday work window, outside a pomodoro focus,
// games are allowed up to a daily budget; the budget shrinks 5 minutes a week to a floor.

export const GAME_BREAK_START = '2026-11-10';
export const GAME_BREAK_FIRST_BUDGET_MIN = 40;
export const GAME_BREAK_STEP_MIN = 5;
export const GAME_BREAK_FLOOR_MIN = 15;
/** One break at most this long; after it games close until the next pause. */
export const GAME_BREAK_MAX_SESSION_MIN = 20;

const DAY_MS = 86_400_000;
const keyMs = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Week 1 from the start date. */
export function gameBreakWeek(today: string, start: string = GAME_BREAK_START): number {
  const diff = Math.floor((keyMs(today) - keyMs(start)) / DAY_MS);
  return diff < 0 ? 1 : Math.floor(diff / 7) + 1;
}

/** Today's work-hours game budget in minutes. */
export function gameBreakBudget(today: string, start: string = GAME_BREAK_START): number {
  const week = gameBreakWeek(today, start);
  return Math.max(GAME_BREAK_FLOOR_MIN, GAME_BREAK_FIRST_BUDGET_MIN - (week - 1) * GAME_BREAK_STEP_MIN);
}

export interface GameBreakState {
  usedToday: number;
  /** Minutes of the current uninterrupted break. */
  currentSession: number;
}

/** Whether a game may run now in the work window (focus and night are checked by the caller). */
export function gameBreakAllowed(today: string, state: GameBreakState, start: string = GAME_BREAK_START): boolean {
  return state.usedToday < gameBreakBudget(today, start) && state.currentSession < GAME_BREAK_MAX_SESSION_MIN;
}
