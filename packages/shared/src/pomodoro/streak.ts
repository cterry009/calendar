export interface CompletedPomodoroSession {
  endedAt: string | null;
  interrupted: boolean;
}

export interface PomodoroStreakResult {
  /** Consecutive credited days, most recent first, not counting grace-covered gaps. */
  currentStreak: number;
  graceDaysTotal: number;
  graceDaysUsed: number;
  graceDaysRemaining: number;
  /** True when at least one session completed today. */
  isActiveToday: boolean;
}

export const DEFAULT_GRACE_DAYS = 2;

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, delta: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
}

/** Distinct local-date keys on which at least one pomodoro was completed (not interrupted, has an end time). */
export function completedPomodoroDateKeys(sessions: CompletedPomodoroSession[]): Set<string> {
  const keys = new Set<string>();
  for (const session of sessions) {
    if (session.interrupted || !session.endedAt) {
      continue;
    }
    const ended = new Date(session.endedAt);
    if (Number.isNaN(ended.getTime())) {
      continue;
    }
    keys.add(dateKey(ended));
  }
  return keys;
}

/**
 * Walks backward from today counting consecutive credited days. A missed day doesn't break the
 * streak immediately -- up to `graceDays` gaps get silently forgiven first (spent one at a time),
 * only breaking the streak once the grace pool runs out. Grace only applies to gaps found *inside*
 * an existing streak, not to bridge into one from a cold start.
 */
export function computePomodoroStreak(
  completedDateKeys: Set<string>,
  options?: { today?: Date; graceDays?: number },
): PomodoroStreakResult {
  const graceDays = options?.graceDays ?? DEFAULT_GRACE_DAYS;
  const today = options?.today ?? new Date();
  const isActiveToday = completedDateKeys.has(dateKey(today));

  if (completedDateKeys.size === 0) {
    return { currentStreak: 0, graceDaysTotal: graceDays, graceDaysUsed: 0, graceDaysRemaining: graceDays, isActiveToday };
  }

  // Bounds how far back grace can bridge gaps: YYYY-MM-DD keys sort lexicographically in
  // chronological order, so this is the earliest day we actually have data for. Without this,
  // an empty gap past the last known session would keep eating grace tokens forever instead of
  // just meaning "no history that far back".
  const earliestKey = [...completedDateKeys].sort()[0];

  let cursor = isActiveToday ? today : addDays(today, -1);
  let currentStreak = 0;
  let graceDaysUsed = 0;
  let foundAny = false;

  while (true) {
    const key = dateKey(cursor);
    if (completedDateKeys.has(key)) {
      currentStreak += 1;
      foundAny = true;
      cursor = addDays(cursor, -1);
      continue;
    }
    if (key < earliestKey) {
      break;
    }
    if (foundAny && graceDaysUsed < graceDays) {
      graceDaysUsed += 1;
      cursor = addDays(cursor, -1);
      continue;
    }
    break;
  }

  return {
    currentStreak,
    graceDaysTotal: graceDays,
    graceDaysUsed,
    graceDaysRemaining: graceDays - graceDaysUsed,
    isActiveToday,
  };
}
