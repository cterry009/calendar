import { useEffect, useMemo, useState } from 'react';
import {
  currentStudySession,
  flexibleWindowToday,
  localDateKey,
  morningStatus,
  nextFlexibleBlockNumber,
  type MorningStatus,
} from '@calendar/shared';
import { useCalendarData } from './useCalendarData';
import { usePlan } from './usePlan';
import { useSchedules } from './useSchedules';
import { useTasks } from './useTasks';
import type { SyncScheduleRecord } from '../lib/schedules/types';
import type { SyncTaskRecord } from '../lib/tasks/types';

export interface MorningWindow {
  /** Today's flexible schedule (Estudio B1, B2 or Pilar E); null on days without one. */
  schedule: SyncScheduleRecord | null;
  start: Date | null;
  end: Date | null;
  /** Now is inside 08:00-12:00. */
  inWindow: boolean;
  /** Past the window's end: a block started now has no 12:00 limit (D11). */
  afterWindow: boolean;
  status: MorningStatus;
  /** The number the next block gets ("Empezar bloque 2"). */
  nextNumber: number;
  /** The line's current study session, the one the block will work on. */
  studyTask: SyncTaskRecord | null;
}

const EMPTY_STATUS: MorningStatus = {
  started: 0,
  done: 0,
  target: 2,
  fulfilled: false,
  blocks: [],
};

function at(minute: number, day: Date): Date {
  const d = new Date(day);
  d.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
  return d;
}

/** Today's flexible morning (dynamic-study-blocks): the window, its blocks and the next one. */
export function useMorningWindow(): MorningWindow {
  const { schedules } = useSchedules();
  const { exceptions } = usePlan();
  const { tasks } = useTasks();
  const { pomodoroSessions } = useCalendarData();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return useMemo(() => {
    const schedule = flexibleWindowToday(schedules, now, exceptions);
    if (!schedule) {
      return {
        schedule: null,
        start: null,
        end: null,
        inWindow: false,
        afterWindow: false,
        status: EMPTY_STATUS,
        nextNumber: 1,
        studyTask: null,
      };
    }
    const start = at(schedule.startMinute, now);
    const end = at(schedule.endMinute, now);
    const sessions = pomodoroSessions ?? [];
    return {
      schedule,
      start,
      end,
      inWindow: now >= start && now < end,
      afterWindow: now >= end,
      status: morningStatus(sessions, localDateKey(now)),
      nextNumber: nextFlexibleBlockNumber(sessions, schedule.id, now),
      studyTask: currentStudySession(schedule.label, tasks),
    };
  }, [schedules, exceptions, tasks, pomodoroSessions, now]);
}
