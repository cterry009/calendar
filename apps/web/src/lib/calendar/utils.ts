import type {
  CalendarDensity,
  CalendarEvent,
  MonthDaySummary,
  SyncPomodoroSession,
  SyncSchedule,
  SyncSnapshot,
  SyncTask,
  WeekDaySummary,
} from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

export function getStartOfWeek(date: Date): Date {
  const day = date.getDay();
  const diffFromMonday = (day + 6) % 7;
  return startOfDay(addDays(date, -diffFromMonday));
}

export function getEndOfWeek(date: Date): Date {
  return endOfDay(addDays(getStartOfWeek(date), 6));
}

export function getStartOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function getEndOfMonth(date: Date): Date {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function parseDate(dateValue: string | null): Date | null {
  if (!dateValue) return null;
  const parsed = new Date(dateValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function minuteToDate(baseDate: Date, minute: number): Date {
  const hour = Math.floor(minute / 60);
  const minuteOfHour = minute % 60;
  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    hour,
    minuteOfHour,
    0,
    0,
  );
}

function overlapsRange(
  start: Date,
  end: Date,
  rangeStart: Date,
  rangeEnd: Date,
): boolean {
  return start <= rangeEnd && end >= rangeStart;
}

function taskToEvent(task: SyncTask): CalendarEvent | null {
  const start = parseDate(task.scheduledAt);
  if (!start) return null;

  const duration = Math.max(1, task.estimatedMinutes);
  return {
    id: `task-${task.id}`,
    type: 'task',
    title: task.title,
    start,
    end: addMinutes(start, duration),
    taskId: task.id,
    meta: { estimatedMinutes: task.estimatedMinutes },
  };
}

function pomodoroToEvent(session: SyncPomodoroSession): CalendarEvent | null {
  const start = parseDate(session.startedAt);
  if (!start) return null;

  const end = parseDate(session.endedAt) ?? addMinutes(start, Math.max(1, session.focusDurationMin));
  return {
    id: `pomodoro-${session.id}`,
    type: 'pomodoro',
    title: 'Sesión pomodoro',
    start,
    end,
    taskId: session.taskId ?? undefined,
    meta: { state: session.state },
  };
}

function scheduleEventsForRange(
  schedules: SyncSchedule[],
  rangeStart: Date,
  rangeEnd: Date,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (let cursor = startOfDay(rangeStart); cursor <= rangeEnd; cursor = addDays(cursor, 1)) {
    const current = startOfDay(cursor);

    for (const schedule of schedules) {
      if (!schedule.enabled || schedule.dayOfWeek !== current.getDay()) continue;

      const start = minuteToDate(current, schedule.startMinute);
      const end = minuteToDate(current, schedule.endMinute);
      if (!overlapsRange(start, end, rangeStart, rangeEnd)) continue;

      events.push({
        id: `schedule-${schedule.id}-${current.toISOString()}`,
        type: schedule.kind === 'WORK' ? 'work' : 'rest',
        title: schedule.label ?? (schedule.kind === 'WORK' ? 'Bloque de trabajo' : 'Descanso'),
        start,
        end,
        meta: { kind: schedule.kind },
      });
    }
  }

  return events;
}

export function buildEventsForRange(
  snapshot: Pick<SyncSnapshot, 'tasks' | 'schedules' | 'pomodoroSessions'>,
  rangeStart: Date,
  rangeEnd: Date,
): CalendarEvent[] {
  const normalizedStart = startOfDay(rangeStart);
  const normalizedEnd = endOfDay(rangeEnd);

  const taskEvents = snapshot.tasks
    .map(taskToEvent)
    .filter((event): event is CalendarEvent =>
      Boolean(event && overlapsRange(event.start, event.end, normalizedStart, normalizedEnd)),
    );

  const pomodoroEvents = snapshot.pomodoroSessions
    .map(pomodoroToEvent)
    .filter((event): event is CalendarEvent =>
      Boolean(event && overlapsRange(event.start, event.end, normalizedStart, normalizedEnd)),
    );

  const scheduleEvents = scheduleEventsForRange(snapshot.schedules, normalizedStart, normalizedEnd);

  return [...taskEvents, ...scheduleEvents, ...pomodoroEvents].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
}

export function eventsForDate(events: CalendarEvent[], date: Date): CalendarEvent[] {
  const dateStart = startOfDay(date);
  const dateEnd = endOfDay(date);
  return events
    .filter((event) => overlapsRange(event.start, event.end, dateStart, dateEnd))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function buildWeekTaskSummary(tasks: SyncTask[], selectedDate: Date): WeekDaySummary[] {
  const weekStart = getStartOfWeek(selectedDate);

  return Array.from({ length: 7 }, (_, index) => {
    const dayDate = addDays(weekStart, index);
    const dayTasks = tasks.filter((task) => {
      const scheduledAt = parseDate(task.scheduledAt);
      return scheduledAt ? isSameDay(scheduledAt, dayDate) : false;
    });

    return {
      date: dayDate,
      taskCount: dayTasks.length,
      totalEstimatedMinutes: dayTasks.reduce((sum, task) => sum + task.estimatedMinutes, 0),
    };
  });
}

function densityFromCount(count: number): CalendarDensity {
  if (count <= 0) return 'none';
  if (count <= 2) return 'low';
  if (count <= 4) return 'medium';
  return 'high';
}

export function buildMonthSummary(
  snapshot: Pick<SyncSnapshot, 'tasks' | 'pomodoroSessions'>,
  selectedDate: Date,
): MonthDaySummary[] {
  const monthStart = getStartOfMonth(selectedDate);
  const monthEnd = getEndOfMonth(selectedDate);
  const gridStart = getStartOfWeek(monthStart);
  const gridEnd = getEndOfWeek(monthEnd);

  const days: MonthDaySummary[] = [];
  for (let cursor = gridStart; cursor <= gridEnd; cursor = addDays(cursor, 1)) {
    const date = startOfDay(cursor);
    const taskCount = snapshot.tasks.filter((task) => {
      const scheduledAt = parseDate(task.scheduledAt);
      return scheduledAt ? isSameDay(scheduledAt, date) : false;
    }).length;

    const pomodoroCount = snapshot.pomodoroSessions.filter((session) => {
      const startedAt = parseDate(session.startedAt);
      return startedAt ? isSameDay(startedAt, date) : false;
    }).length;

    days.push({
      date,
      inCurrentMonth: date.getMonth() === selectedDate.getMonth(),
      taskCount,
      pomodoroCount,
      density: densityFromCount(taskCount + pomodoroCount),
    });
  }

  return days;
}
