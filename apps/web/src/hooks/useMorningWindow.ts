import { useEffect, useMemo, useState } from 'react';
import {
  afternoonStatus,
  currentStudySession,
  localDateKey,
  morningStatus,
  scheduleOnDate,
  windowForMinute,
  type DayWindowName,
  type MorningStatus,
  type WindowStatus,
} from '@calendar/shared';
import { useCalendarData } from './useCalendarData';
import { usePlan } from './usePlan';
import { useSchedules } from './useSchedules';
import { useTasks } from './useTasks';
import type { SyncScheduleRecord } from '../lib/schedules/types';
import type { SyncTaskRecord } from '../lib/tasks/types';

export interface DaySuggestion {
  schedule: SyncScheduleRecord;
  /** The suggested start and end today (exceptions applied). */
  start: Date;
  end: Date;
  window: DayWindowName | null;
  /** The end of its window today (13:00, 18:00): no focus starts after it. */
  windowEnd: Date | null;
  /** Started today already (any session on this schedule). */
  started: boolean;
  /** The study session it will work on (study lines only). */
  studyTask: SyncTaskRecord | null;
  /** The category's suggested pomodoro labels (afternoon), if any. */
  focusLabels: string[] | undefined;
}

export interface DayBlocks {
  /** Today's flexible suggestions, in time order; empty on days without them (Saturday, Sunday). */
  suggestions: DaySuggestion[];
  /** The one "Empezar" offers: the first not started whose window is still open, else null. */
  next: DaySuggestion | null;
  morning: MorningStatus;
  afternoon: WindowStatus;
}

function at(minute: number, day: Date): Date {
  const d = new Date(day);
  d.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
  return d;
}

/** Today's flexible blocks (dynamic-study-blocks, revision 2): the suggestions, which are done, the next. */
export function useDayBlocks(): DayBlocks {
  const { schedules } = useSchedules();
  const { plan, exceptions } = usePlan();
  const { tasks } = useTasks();
  const { pomodoroSessions } = useCalendarData();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return useMemo(() => {
    const sessions = pomodoroSessions ?? [];
    const dateKey = localDateKey(now);
    const today = sessions.filter(
      (s) => s.blockStartAt && localDateKey(new Date(s.blockStartAt)) === dateKey,
    );
    const suggestions = schedules
      .filter(
        (s) =>
          s.kind === 'WORK' &&
          s.enabled &&
          !!s.flexibleBlocks &&
          s.daysOfWeek.includes(now.getDay()),
      )
      .map((template) => {
        const schedule = exceptions.length ? scheduleOnDate(template, exceptions, now) : template;
        const window = windowForMinute(schedule.startMinute);
        const category = schedule.category as
          keyof NonNullable<typeof plan>['pomodoros_sugeridos'] | null | undefined;
        return {
          schedule,
          start: at(schedule.startMinute, now),
          end: at(schedule.endMinute, now),
          window: window?.name ?? null,
          windowEnd: window ? at(window.endMinute, now) : null,
          started: today.some((s) => s.scheduleId === schedule.id),
          studyTask: currentStudySession(schedule.label, tasks),
          focusLabels: category && plan ? plan.pomodoros_sugeridos[category] : undefined,
        };
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    const next = suggestions.find((s) => !s.started && (!s.windowEnd || now < s.windowEnd)) ?? null;
    return {
      suggestions,
      next,
      morning: morningStatus(sessions, dateKey),
      afternoon: afternoonStatus(sessions, dateKey),
    };
  }, [schedules, plan, exceptions, tasks, pomodoroSessions, now]);
}
