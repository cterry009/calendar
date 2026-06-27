import type { SuggestionInput } from '@calendar/shared';
import type { DashboardSnapshot } from './types';

const DEFAULT_SHORT_BREAK_MIN = 5;

export function buildSuggestionInput(snapshot: DashboardSnapshot): Omit<SuggestionInput, 'estimationByDifficulty'> {
  const productivityDays = snapshot.tasks
    .filter((task) => task.status === 'COMPLETED' && !!task.completedAt)
    .map((task) => {
      const completedAt = new Date(task.completedAt as string);
      return {
        date: toDateKey(completedAt),
        tasksCompleted: 1,
        hourOfDay: completedAt.getHours(),
      };
    });

  const focusStreaksByDay = new Map<string, { focusMinutes: number; breakMinutes: number }>();

  for (const session of snapshot.pomodoroSessions) {
    const timestamp = session.startedAt ?? session.endedAt;
    if (!timestamp) {
      continue;
    }

    const dateKey = toDateKey(new Date(timestamp));
    const current = focusStreaksByDay.get(dateKey) ?? { focusMinutes: 0, breakMinutes: 0 };
    const completedCycles = Math.max(session.completedCycles ?? 0, 0);
    const shortBreakMin = session.shortBreakMin ?? DEFAULT_SHORT_BREAK_MIN;

    current.focusMinutes += session.focusDurationMin;
    current.breakMinutes += completedCycles * shortBreakMin;

    focusStreaksByDay.set(dateKey, current);
  }

  const focusStreaks = [...focusStreaksByDay.entries()].map(([date, values]) => ({
    date,
    focusMinutes: values.focusMinutes,
    breakMinutes: values.breakMinutes,
  }));

  const pomodoroSessions = snapshot.pomodoroSessions
    .filter((session) => !!session.startedAt)
    .map((session) => ({
      interrupted: session.interrupted,
      startedAt: session.startedAt as string,
      focusMinutes: session.focusDurationMin,
    }));

  const fitnessExerciseDays = snapshot.fitnessEntries
    .filter((entry) => entry.durationMinutes > 0)
    .map((entry) => toDateKey(new Date(entry.loggedAt)));

  return {
    productivityDays,
    focusStreaks,
    pomodoroSessions,
    fitnessExerciseDays,
  };
}

function toDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}
