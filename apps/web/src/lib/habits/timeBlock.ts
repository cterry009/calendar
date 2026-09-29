// A habit's optional time block: when in the day it happens. Stored in the habit's existing
// reminderStartMinute / reminderEndMinute / reminderDaysOfWeek fields (added for the mobile
// reminder notification, task 11.5), so the calendar block and the phone reminder are the same
// thing and can't drift apart.
//
// Two shapes, both already in use by mobile's habit templates:
//   - a window ("arreglarse 8:00-9:00"): start and end;
//   - a deadline ("despertarse antes de las 7"): end only. It still shows on the calendar, as a
//     short block ending at the deadline, so the day view says when it's due.

export const DEADLINE_BLOCK_MINUTES = 15;
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export interface HabitTimeBlockFields {
  reminderStartMinute: number | null;
  reminderEndMinute: number | null;
  reminderDaysOfWeek: number[];
}

/** "07:30" -> 450; "" -> null; anything invalid -> undefined. */
export function parseTimeInput(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}

export function formatTimeInput(minutes: number | null): string {
  if (minutes == null) return '';
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** Form validation, in Spanish for display. null = valid. */
export function validateTimeBlock(start: number | null, end: number | null, days: number[]): string | null {
  if (start == null && end == null) return null;
  if (end == null) return 'Indica la hora de fin (o solo la hora limite, sin inicio).';
  if (start != null && start >= end) return 'La hora de inicio debe ser antes que la de fin.';
  if (days.length === 0) return 'Elige al menos un dia para el bloque.';
  return null;
}

export function hasTimeBlock(habit: HabitTimeBlockFields): boolean {
  return habit.reminderEndMinute != null;
}

/** Minutes [start, end) of the block on a day it applies to; null when the habit has no block. */
export function timeBlockRange(habit: HabitTimeBlockFields): { start: number; end: number } | null {
  if (habit.reminderEndMinute == null) return null;
  const end = habit.reminderEndMinute;
  const start = habit.reminderStartMinute ?? Math.max(0, end - DEADLINE_BLOCK_MINUTES);
  return { start, end };
}

export function describeTimeBlock(habit: HabitTimeBlockFields): string | null {
  if (habit.reminderEndMinute == null) return null;
  return habit.reminderStartMinute == null
    ? `antes de las ${formatTimeInput(habit.reminderEndMinute)}`
    : `${formatTimeInput(habit.reminderStartMinute)}-${formatTimeInput(habit.reminderEndMinute)}`;
}
