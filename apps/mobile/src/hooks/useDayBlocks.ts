import { useEffect, useMemo, useState } from 'react';
import {
  afternoonStatus,
  currentStudySession,
  localDateKey,
  morningStatus,
  scheduleOnDate,
  windowForMinute,
  type MorningStatus,
  type WindowStatus,
} from '@calendar/shared';
import { useCalendarData } from './useCalendarData';
import type { SyncScheduleRecord, SyncTaskRecord } from '../lib/calendar/types';

// Today's flexible blocks on the phone (dynamic-study-blocks revision 2): the four suggestions, which
// were started, the day's minimum and the next one to offer. Mirrors the web's useDayBlocks.

export interface DaySuggestion {
  schedule: SyncScheduleRecord;
  start: Date;
  /** The end of its window today (13:00, 18:00): no focus starts after it. */
  windowEnd: Date | null;
  started: boolean;
  studyTask: SyncTaskRecord | null;
  focusLabels: string[] | undefined;
}

export interface DayBlocks {
  suggestions: DaySuggestion[];
  next: DaySuggestion | null;
  morning: MorningStatus;
  afternoon: WindowStatus;
}

function at(minute: number, day: Date): Date {
  const d = new Date(day);
  d.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
  return d;
}

export function useDayBlocks(): DayBlocks {
  const { schedules, exceptions, tasks, pomodoroSessions, plan } = useCalendarData();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  return useMemo(() => {
    const dateKey = localDateKey(now);
    const today = pomodoroSessions.filter((s) => s.blockStartAt && localDateKey(new Date(s.blockStartAt)) === dateKey);
    const suggestions = schedules
      .filter((s) => s.kind === 'WORK' && s.enabled && !!s.flexibleBlocks && s.daysOfWeek.includes(now.getDay()))
      .map((template) => {
        const schedule = exceptions.length ? scheduleOnDate(template, exceptions, now) : template;
        const window = windowForMinute(schedule.startMinute);
        const category = schedule.category as keyof NonNullable<typeof plan>['pomodoros_sugeridos'] | null | undefined;
        return {
          schedule,
          start: at(schedule.startMinute, now),
          windowEnd: window ? at(window.endMinute, now) : null,
          started: today.some((s) => s.scheduleId === schedule.id),
          studyTask: currentStudySession(schedule.label, tasks),
          focusLabels: category && plan ? plan.pomodoros_sugeridos[category] : undefined,
        };
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    return {
      suggestions,
      next: suggestions.find((s) => !s.started && (!s.windowEnd || now < s.windowEnd)) ?? null,
      morning: morningStatus(pomodoroSessions, dateKey),
      afternoon: afternoonStatus(pomodoroSessions, dateKey),
    };
  }, [schedules, exceptions, tasks, pomodoroSessions, plan, now]);
}
