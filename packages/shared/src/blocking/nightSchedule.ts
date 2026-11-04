// The night block's start by day and by app (weekend-mode, user 2026-11-02/04). The window used to be
// one start for every night; now:
//   - Friday and Saturday nights start at the window's `weekendStartMinutes` (00:00 by default);
//   - a NIGHT block-list entry can start at its own time (League of Legends at 20:00 on weeknights,
//     Discord at 22:00 every night), replacing the general start for that app or site only.
// The end (08:00) and the morning unlock are the same every day. Pure, so the phone (JS + the
// Kotlin mirror in NightBlockRules.kt), the PC and the tests agree on one rule.
//
// "The night of day D" starts on D's evening and ends on D+1's morning. A start of 0 means "from
// midnight": D's evening isn't blocked, and the block begins at D+1 00:00.

const DAY_MINUTES = 24 * 60;

/** Days (Date.getDay(), 0 = Sunday) whose night is a weekend night: Friday and Saturday. */
export const WEEKEND_NIGHT_DAYS: readonly number[] = [5, 6];

/** 00:00, the default start on weekend nights. */
export const DEFAULT_WEEKEND_NIGHT_START = 0;

/** A per-app start, or the earliest a weekend start may be other than midnight: 18:00. */
export const EARLIEST_NIGHT_START = 18 * 60;

export interface NightWindowTimes {
  startMinutes: number;
  endMinutes: number;
  weekendStartMinutes?: number;
}

/** A NIGHT entry's own start times; null/undefined = the window's. */
export interface NightStartOverride {
  nightStartMinutes?: number | null;
  weekendNightStartMinutes?: number | null;
}

export function isWeekendNight(day: number): boolean {
  return WEEKEND_NIGHT_DAYS.includes(day);
}

/** When the night of `day` starts for an app with `override` (or the general rule without one). */
export function nightStartForDay(day: number, window: NightWindowTimes, override?: NightStartOverride | null): number {
  if (isWeekendNight(day)) {
    return override?.weekendNightStartMinutes ?? window.weekendStartMinutes ?? DEFAULT_WEEKEND_NIGHT_START;
  }
  return override?.nightStartMinutes ?? window.startMinutes;
}

function minuteOf(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Inside the night window right now (the whole window, ignoring the morning unlock): the evening of
 * today's night from its start, or the morning before the window's end. The morning belongs to the
 * night that began yesterday, but every night ends at the same time, so only the evening needs the day.
 */
export function isInNightWindow(date: Date, window: NightWindowTimes, override?: NightStartOverride | null): boolean {
  const minute = minuteOf(date);
  if (minute < window.endMinutes) return true;
  const start = nightStartForDay(date.getDay(), window, override);
  return start > 0 && minute >= start;
}

/** Minutes until the next night start for this app (0 at the start minute), up to a week ahead. */
export function minutesUntilNextNightStart(date: Date, window: NightWindowTimes, override?: NightStartOverride | null): number {
  const now = minuteOf(date);
  for (let ahead = 0; ahead < 8; ahead++) {
    const day = (date.getDay() + ahead) % 7;
    const start = nightStartForDay(day, window, override);
    // From midnight: the block begins at the next day's 00:00.
    const at = ahead * DAY_MINUTES + (start > 0 ? start : DAY_MINUTES);
    if (at >= now) return at - now;
  }
  return DAY_MINUTES;
}

/** "22:00", "00:00". */
export function formatNightMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * A night start must be in the evening (18:00 or later) or exactly midnight. The window's own
 * weekday start keeps its older rule (the 8-hour minimum, nightWindow.ts / state.ts).
 */
export function validateNightStart(start: number): { ok: true } | { ok: false; error: string } {
  if (!Number.isInteger(start) || start < 0 || start >= DAY_MINUTES) {
    return { ok: false, error: 'Hora inválida.' };
  }
  if (start !== 0 && start < EARLIEST_NIGHT_START) {
    return { ok: false, error: 'La hora de inicio debe ser desde las 18:00, o a las 00:00.' };
  }
  return { ok: true };
}

/**
 * How late a start is, for comparing two starts of the same night: 18:00 < 23:59 < 00:00 (midnight is
 * the latest, the evening is free). Used by the block commitment: a start may only move earlier.
 */
export function nightStartLateness(start: number): number {
  return start === 0 ? DAY_MINUTES : start;
}

/** True when `next` blocks no less than `current` (the same or an earlier start). */
export function isNightStartNoLater(next: number | null | undefined, current: number | null | undefined, fallback: number): boolean {
  return nightStartLateness(next ?? fallback) <= nightStartLateness(current ?? fallback);
}

export interface NightWarningTarget {
  /** "League of Legends", or null for the general block (social media and games). */
  label: string | null;
  override?: NightStartOverride | null;
}

/** The warning lead and repeat, the same on the phone and the PC. */
export const NIGHT_WARNING_LEAD = 30;

/**
 * The block starting within the warning lead (1..30 minutes away), the nearest first; one per
 * distinct start, with every app starting then. Null when nothing is about to start.
 */
export function upcomingNightStart(
  date: Date,
  window: NightWindowTimes,
  targets: readonly NightWarningTarget[],
): { minutesLeft: number; start: number; labels: Array<string | null> } | null {
  let best: { minutesLeft: number; start: number; labels: Array<string | null> } | null = null;
  for (const target of targets) {
    const minutesLeft = minutesUntilNextNightStart(date, window, target.override);
    if (minutesLeft < 1 || minutesLeft > NIGHT_WARNING_LEAD) continue;
    const start = (minuteOf(date) + minutesLeft) % DAY_MINUTES;
    if (!best || minutesLeft < best.minutesLeft) {
      best = { minutesLeft, start, labels: [target.label] };
    } else if (minutesLeft === best.minutesLeft && !best.labels.includes(target.label)) {
      best.labels.push(target.label);
    }
  }
  return best;
}

/** "las redes sociales y los juegos", "League of Legends", "League of Legends y Discord". */
export function nightWarningSubject(labels: ReadonlyArray<string | null>): string {
  const names = labels.map((label) => label ?? 'las redes sociales y los juegos');
  if (names.length <= 1) return names[0] ?? 'las redes sociales y los juegos';
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}
