import type { SyncScheduleRecord } from './types';

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Ported from apps/web/src/lib/calendar/utils.ts -- pure, no DOM dependency. Used by
// useFocusBlocking.ts (task 6.6) as one of the three blocking triggers ("work-hours mode" in
// 6.8's test scope); apps/web's own home page never had a live "is it work hours right now"
// display, only SoftFocusContext consuming it, so this didn't exist on mobile until now.
export function findActiveWorkSchedule<
  T extends Pick<SyncScheduleRecord, 'kind' | 'daysOfWeek' | 'startMinute' | 'endMinute' | 'enabled'>,
>(schedules: T[], now: Date): T | null {
  const nowMinute = now.getHours() * 60 + now.getMinutes();
  const day = now.getDay();
  return (
    schedules.find(
      (schedule) =>
        schedule.enabled &&
        schedule.kind === 'WORK' &&
        schedule.daysOfWeek.includes(day) &&
        nowMinute >= schedule.startMinute &&
        nowMinute < schedule.endMinute,
    ) ?? null
  );
}

export function isNowWithinWorkSchedule(
  schedules: Array<Pick<SyncScheduleRecord, 'kind' | 'daysOfWeek' | 'startMinute' | 'endMinute' | 'enabled'>>,
  now: Date,
): boolean {
  return findActiveWorkSchedule(schedules, now) !== null;
}

export function minuteToTimeValue(totalMinutes: number): string {
  const boundedMinutes = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59));
  const hours = Math.floor(boundedMinutes / 60);
  const minutes = boundedMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// 0=Sunday..6=Saturday, matches JS Date.getDay() (same convention the server's daysOfWeek uses).
export const DAY_ABBREVIATIONS_ES = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

export function formatDaysOfWeek(daysOfWeek: number[]): string {
  return [...daysOfWeek]
    .sort((a, b) => a - b)
    .map((day) => DAY_ABBREVIATIONS_ES[day])
    .join(', ');
}
