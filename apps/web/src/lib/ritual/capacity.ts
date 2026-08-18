import type { SyncScheduleRecord } from '../schedules/types';
import { generateFocusPlan, resolveFocusPlanConfig } from '../pomodoro/planner';

export interface PomodoroSlot {
  scheduleId: string;
  startMinute: number;
  endMinute: number;
}

export function getTodayWorkSchedules(schedules: SyncScheduleRecord[], now: Date): SyncScheduleRecord[] {
  const day = now.getDay();
  return schedules.filter((schedule) => schedule.enabled && schedule.kind === 'WORK' && schedule.daysOfWeek.includes(day));
}

/** Real pomodoro slots available today, across every WORK schedule active today -- this is the
 * app's actual notion of "capacity" (see `packages/shared` estimation-accuracy, which is a
 * different concept: historical estimate bias, not how much room today has). */
export function getTodayPomodoroSlots(schedules: SyncScheduleRecord[], now: Date): PomodoroSlot[] {
  const slots: PomodoroSlot[] = [];

  for (const schedule of getTodayWorkSchedules(schedules, now)) {
    const config = resolveFocusPlanConfig(schedule);
    const plan = generateFocusPlan(schedule.startMinute, schedule.endMinute, config);

    for (const segment of plan) {
      if (segment.type === 'pomodoro') {
        slots.push({ scheduleId: schedule.id, startMinute: segment.startMinute, endMinute: segment.endMinute });
      }
    }
  }

  return slots.sort((a, b) => a.startMinute - b.startMinute);
}

export function minuteToISOForDate(minute: number, referenceDate: Date): string {
  const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), 0, 0, 0, 0);
  date.setMinutes(minute);
  return date.toISOString();
}
