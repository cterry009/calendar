import { findFreeSlots } from '@calendar/shared';
import { EXCLUDED_WORK_WINDOWS } from '../pomodoro/planner';
import { isSameDay } from '../calendar/utils';
import type { SyncSchedule } from '../calendar/types';
import type { SyncTaskRecord } from './types';

export interface SuggestedSlot {
  start: Date;
  end: Date;
  durationMinutes: number;
}

function minuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function atMinute(date: Date, minute: number): Date {
  const result = new Date(date);
  result.setHours(0, minute, 0, 0);
  return result;
}

/**
 * Open ranges within `date`'s WORK schedules that fit `requiredMinutes` and aren't already taken
 * by another scheduled task or the fixed lunch window -- assistive suggestions for the task form
 * and calendar, not an auto-scheduler.
 */
export function findSuggestedSlotsForDay(
  date: Date,
  schedules: SyncSchedule[],
  tasks: SyncTaskRecord[],
  requiredMinutes: number,
  maxResults = 3,
): SuggestedSlot[] {
  const dayOfWeek = date.getDay();
  const workRanges = schedules
    .filter((schedule) => schedule.kind === 'WORK' && schedule.enabled && schedule.daysOfWeek.includes(dayOfWeek))
    .map((schedule) => ({ startMinute: schedule.startMinute, endMinute: schedule.endMinute }));

  if (workRanges.length === 0 || requiredMinutes <= 0) {
    return [];
  }

  const occupiedFromTasks = tasks
    .filter((task) => task.scheduledAt && task.status !== 'CANCELLED' && isSameDay(new Date(task.scheduledAt), date))
    .map((task) => {
      const start = minuteOfDay(new Date(task.scheduledAt as string));
      return { startMinute: start, endMinute: start + task.estimatedMinutes };
    });

  const earliestMinute = isSameDay(date, new Date()) ? minuteOfDay(new Date()) : 0;

  const slots = findFreeSlots({
    workRanges,
    occupiedRanges: [...occupiedFromTasks, ...EXCLUDED_WORK_WINDOWS],
    requiredMinutes,
    earliestMinute,
    maxResults,
  });

  return slots.map((slot) => ({
    start: atMinute(date, slot.startMinute),
    end: atMinute(date, slot.endMinute),
    durationMinutes: slot.durationMinutes,
  }));
}
