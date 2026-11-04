// Weekend activities (weekend-mode, user 2026-11-04): reminders for things to do on Saturday or
// Sunday -- chores, plans, people -- not study. Stored as a Habit with kind WEEKEND_ACTIVITY so the
// phone's reminder at a time and the "hecho" check-in come for free, but they are not habits: no
// score, not in the habit list. At most WEEKEND_ACTIVITY_DAILY_CAP per day, so the weekend doesn't
// fill up with obligations ("que se restrinja la cantidad").

export const HABIT_KINDS = ['HABIT', 'WEEKEND_ACTIVITY'] as const;
export type HabitKind = (typeof HABIT_KINDS)[number];

/** Saturday and Sunday (Date.getDay()). */
export const WEEKEND_ACTIVITY_DAYS: readonly number[] = [6, 0];

export const WEEKEND_ACTIVITY_DAILY_CAP = 3;

export interface WeekendActivityLike {
  id?: string;
  kind?: HabitKind | string | null;
  archived?: boolean;
  deletedAt?: string | Date | null;
  reminderDaysOfWeek: readonly number[];
}

export function isWeekendActivity(habit: { kind?: HabitKind | string | null }): boolean {
  return habit.kind === 'WEEKEND_ACTIVITY';
}

/** A habit proper (the habit list, its score, the daily report's "Hábitos x de y"). */
export function isPlainHabit(habit: { kind?: HabitKind | string | null }): boolean {
  return !isWeekendActivity(habit);
}

function isLive(habit: WeekendActivityLike): boolean {
  return isWeekendActivity(habit) && !habit.archived && !habit.deletedAt;
}

/** How many live activities fall on `day`. */
export function weekendActivitiesOn(habits: readonly WeekendActivityLike[], day: number, exceptId?: string): number {
  return habits.filter((h) => isLive(h) && h.id !== exceptId && h.reminderDaysOfWeek.includes(day)).length;
}

/**
 * Whether `candidate` (new, or an edit of an existing one, matched by id) fits: one weekend day, and
 * that day under the cap. The error is shown as is in the form.
 */
export function checkWeekendActivity(
  habits: readonly WeekendActivityLike[],
  candidate: WeekendActivityLike,
): { ok: true } | { ok: false; error: string } {
  const days = candidate.reminderDaysOfWeek;
  if (days.length !== 1 || !WEEKEND_ACTIVITY_DAYS.includes(days[0])) {
    return { ok: false, error: 'Elige sábado o domingo.' };
  }
  if (candidate.archived || candidate.deletedAt) return { ok: true };
  const day = days[0];
  if (weekendActivitiesOn(habits, day, candidate.id) >= WEEKEND_ACTIVITY_DAILY_CAP) {
    const name = day === 6 ? 'el sábado' : 'el domingo';
    return {
      ok: false,
      error: `Ya tienes ${WEEKEND_ACTIVITY_DAILY_CAP} actividades ${name}: es el máximo, para que el fin de semana siga siendo descanso.`,
    };
  }
  return { ok: true };
}
