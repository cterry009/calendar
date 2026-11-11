import { localDateKey } from '@calendar/shared';
import type { SyncHabit, SyncHabitRecord, SyncPomodoroSession, SyncSchedule, SyncScheduleCompletion, SyncTask } from '../calendar/types';

// 2026-11-10: the short reference at the top right -- goals met today and this week (habits at their
// goal, work blocks done, tasks closed), the last energy registered and a line that fits.

export interface GoalCount {
  done: number;
  total: number;
}

interface Input {
  habits: SyncHabit[];
  habitRecords: SyncHabitRecord[];
  schedules: SyncSchedule[];
  scheduleCompletions: SyncScheduleCompletion[];
  pomodoroSessions: SyncPomodoroSession[];
  tasks: SyncTask[];
}

const key = (d: Date) => localDateKey(d);

function dayGoals(input: Input, day: Date): GoalCount {
  const k = key(day);
  const habits = input.habits.filter((h) => !h.archived && h.type === 'NORMAL');
  const habitDone = habits.filter((h) => {
    const r = input.habitRecords.find((x) => x.habitId === h.id && x.date.slice(0, 10) === k);
    return !!r && r.value >= h.dailyGoalValue;
  }).length;
  const blocks = input.schedules.filter((s) => s.enabled && s.kind === 'WORK' && s.daysOfWeek.includes(day.getDay()));
  const blockDone = blocks.filter(
    (s) =>
      input.scheduleCompletions.some((c) => c.scheduleId === s.id && c.date.slice(0, 10) === k && c.status !== 'SKIPPED') ||
      input.pomodoroSessions.some((p) => p.scheduleId === s.id && p.startedAt && key(new Date(p.startedAt)) === k && p.completedCycles > 0),
  ).length;
  const tasks = input.tasks.filter((t) => !t.deletedAt);
  const closed = tasks.filter((t) => t.completedAt && key(new Date(t.completedAt)) === k).length;
  const openDue = tasks.filter((t) => t.status !== 'COMPLETED' && t.scheduledAt && key(new Date(t.scheduledAt)) === k).length;
  return { done: habitDone + blockDone + closed, total: habits.length + blocks.length + closed + openDue };
}

export function goalsToday(input: Input, now = new Date()): GoalCount {
  return dayGoals(input, now);
}

/** Monday to today. */
export function goalsWeek(input: Input, now = new Date()): GoalCount {
  const back = (now.getDay() + 6) % 7;
  let done = 0;
  let total = 0;
  for (let i = back; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const g = dayGoals(input, d);
    done += g.done;
    total += g.total;
  }
  return { done, total };
}

const PHRASES = {
  high: ['Sigue así.', 'Buen ritmo: mantenlo.', 'Vas muy bien hoy.'],
  mid: ['Vas bien, un paso a la vez.', 'Lo importante es no soltar el hilo.', 'Medio camino hecho: sigue.'],
  low: ['No te preocupes: con constancia se puede.', 'Un bloque pequeño cuenta.', 'Empieza por lo más corto; el resto sigue.'],
};

/** A line for the ratio, stable through the day (no flicker on every render). */
export function motivation(g: GoalCount, now = new Date()): string {
  const r = g.total ? g.done / g.total : 0;
  const list = r >= 0.7 ? PHRASES.high : r >= 0.4 ? PHRASES.mid : PHRASES.low;
  return list[now.getDate() % list.length];
}
