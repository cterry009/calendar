import type { Schedule } from '@prisma/client';
import type { PlanningSlot } from './planning.types';

// Defaults for a WORK schedule with no pomodoro plan of its own: the 40-minute pomodoro the study
// import sizes tasks with, and the shortest short break the app allows.
export const DEFAULT_POMODORO_MIN = 40;
export const DEFAULT_SHORT_BREAK_MIN = 5;

/**
 * How many pomodoros fit in a WORK block. Uses the user's own plan (pomodorosPerChunk x chunks)
 * when it's set; otherwise packs pomodoro + short break into the window. An approximation of the
 * client's focus plan (packages/shared focusPlan.ts), which the server doesn't import.
 */
export function blockCapacity(schedule: Pick<Schedule, 'startMinute' | 'endMinute' | 'pomodoroMin' | 'shortBreakMin' | 'pomodorosPerChunk' | 'chunks'>): number {
  if (schedule.pomodorosPerChunk && schedule.chunks) return schedule.pomodorosPerChunk * schedule.chunks;
  const pomodoro = schedule.pomodoroMin ?? DEFAULT_POMODORO_MIN;
  const brk = schedule.shortBreakMin ?? DEFAULT_SHORT_BREAK_MIN;
  const window = schedule.endMinute - schedule.startMinute;
  // The last pomodoro needs no break after it.
  return Math.max(0, Math.floor((window + brk) / (pomodoro + brk)));
}

/** Consecutive local dates starting at `from` (YYYY-MM-DD). */
export function dateRange(from: string, count: number): string[] {
  const start = Date.parse(`${from}T00:00:00Z`);
  return Array.from({ length: count }, (_, i) => new Date(start + i * 86_400_000).toISOString().slice(0, 10));
}

export function dayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** An instant as the user's local date and minute of the day, in an IANA time zone. */
export function toLocal(instant: Date, timeZone: string): { date: string; minute: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minute: Number(parts.hour) * 60 + Number(parts.minute) };
}

/** Every enabled WORK schedule on every day it applies to, with its capacity and nothing used yet. */
export function buildSlots(schedules: Schedule[], days: string[]): PlanningSlot[] {
  const slots: PlanningSlot[] = [];
  for (const date of days) {
    const dow = dayOfWeek(date);
    for (const s of schedules) {
      if (!s.enabled || s.kind !== 'WORK' || !s.daysOfWeek.includes(dow)) continue;
      slots.push({
        scheduleId: s.id,
        label: s.label,
        date,
        startMinute: s.startMinute,
        endMinute: s.endMinute,
        pomodoroMin: s.pomodoroMin ?? DEFAULT_POMODORO_MIN,
        shortBreakMin: s.shortBreakMin ?? DEFAULT_SHORT_BREAK_MIN,
        capacity: blockCapacity(s),
        used: 0,
      });
    }
  }
  return slots.sort((a, b) => a.date.localeCompare(b.date) || a.startMinute - b.startMinute);
}

export function slotKey(scheduleId: string, date: string): string {
  return `${scheduleId}@${date}`;
}
