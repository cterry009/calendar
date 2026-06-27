import {
  calculateEstimationAccuracy,
  calculateFitnessProductivityCorrelation,
  generateSuggestions,
  type TaskDifficulty,
} from '@calendar/shared';
import type { DashboardMetrics, DashboardSnapshot, DashboardWeekMetric, FocusByDayPoint } from './types';

const DIFFICULTIES: TaskDifficulty[] = ['EASY', 'MEDIUM', 'HARD'];
const DAY_COUNT = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function buildDashboardMetrics(snapshot: DashboardSnapshot, now = new Date()): DashboardMetrics {
  const today = toStartOfDay(now);
  const currentWeekStart = startOfWeek(today);
  const previousWeekStart = new Date(currentWeekStart.getTime() - 7 * MS_PER_DAY);
  const rangeStart = new Date(currentWeekStart.getTime() - 7 * MS_PER_DAY);

  const completedTasks = snapshot.tasks.filter((task) => task.status === 'COMPLETED' && !!task.completedAt);
  const completedPomodoros = snapshot.pomodoroSessions.filter(
    (session) => !session.interrupted && !!session.endedAt,
  );

  const tasksCurrentWeek = completedTasks.filter((task) => isWithinWeek(task.completedAt, currentWeekStart));
  const tasksPreviousWeek = completedTasks.filter((task) => isWithinWeek(task.completedAt, previousWeekStart));

  const pomodorosCurrentWeek = completedPomodoros.filter((session) =>
    isWithinWeek(session.endedAt ?? session.startedAt, currentWeekStart),
  );
  const pomodorosPreviousWeek = completedPomodoros.filter((session) =>
    isWithinWeek(session.endedAt ?? session.startedAt, previousWeekStart),
  );

  const focusedMinutesCurrentWeek = sumFocusMinutes(pomodorosCurrentWeek);
  const focusedMinutesPreviousWeek = sumFocusMinutes(pomodorosPreviousWeek);

  const completedWithActual = completedTasks.filter((task) => task.actualMinutes !== null);
  const estimationRecords = completedWithActual.map((task) => ({
    difficulty: task.difficulty,
    estimatedMinutes: task.estimatedMinutes,
    actualMinutes: task.actualMinutes ?? task.estimatedMinutes,
  }));

  const estimatedMinutes = completedWithActual.reduce((sum, task) => sum + task.estimatedMinutes, 0);
  const actualMinutes = completedWithActual.reduce((sum, task) => sum + (task.actualMinutes ?? 0), 0);
  const varianceMinutes = actualMinutes - estimatedMinutes;
  const variancePct = estimatedMinutes > 0 ? round((varianceMinutes / estimatedMinutes) * 100) : 0;

  const completionByDifficulty = DIFFICULTIES.map((difficulty) => {
    const total = snapshot.tasks.filter((task) => task.difficulty === difficulty).length;
    const completed = completedTasks.filter((task) => task.difficulty === difficulty).length;
    return {
      difficulty,
      completed,
      total,
      completionRate: total > 0 ? round((completed / total) * 100) : 0,
    };
  });

  const dailyPoints = buildDailyPoints(completedTasks, completedPomodoros, snapshot.fitnessEntries, rangeStart);

  const productivity = dailyPoints.map((point) => ({
    date: point.date,
    tasksCompleted: point.tasksCompleted,
    pomodorosCompleted: point.pomodorosCompleted,
  }));

  const fitness = dailyPoints.map((point) => ({
    date: point.date,
    exerciseMinutes: point.exerciseMinutes,
  }));

  const fitnessCorrelation = calculateFitnessProductivityCorrelation(productivity, fitness);
  const estimationAccuracy = calculateEstimationAccuracy(estimationRecords);
  const suggestions = generateSuggestions({
    estimationByDifficulty: estimationAccuracy.byDifficulty,
    pomodoroSessions: completedPomodoros.map((session) => ({
      interrupted: session.interrupted,
      startedAt: session.startedAt ?? session.endedAt ?? new Date().toISOString(),
      focusMinutes: session.focusDurationMin,
    })),
    focusStreaks: dailyPoints.map((point) => ({
      date: point.date,
      focusMinutes: point.focusMinutes,
      breakMinutes: 15,
    })),
    productivityDays: dailyPoints.map((point) => ({
      date: point.date,
      tasksCompleted: point.tasksCompleted,
      hourOfDay: 10,
    })),
    fitnessExerciseDays: fitness.filter((entry) => entry.exerciseMinutes > 0).map((entry) => entry.date),
  });

  const hasData = snapshot.tasks.length > 0 || snapshot.pomodoroSessions.length > 0 || snapshot.fitnessEntries.length > 0;

  return {
    hasData,
    tasksCompleted: buildWeekMetric(tasksCurrentWeek.length, tasksPreviousWeek.length),
    pomodorosCompleted: buildWeekMetric(pomodorosCurrentWeek.length, pomodorosPreviousWeek.length),
    focusHours: buildWeekMetric(round(focusedMinutesCurrentWeek / 60), round(focusedMinutesPreviousWeek / 60)),
    focusByDay: dailyPoints.map((point) => ({
      date: point.date,
      label: point.label,
      focusHours: round(point.focusMinutes / 60),
    })),
    estimatedVsActual: {
      estimatedMinutes,
      actualMinutes,
      varianceMinutes,
      variancePct,
    },
    estimationAccuracy,
    completionByDifficulty,
    fitnessCorrelation,
    suggestions,
  };
}

function buildDailyPoints(
  tasks: DashboardSnapshot['tasks'],
  pomodoros: DashboardSnapshot['pomodoroSessions'],
  fitnessEntries: DashboardSnapshot['fitnessEntries'],
  rangeStart: Date,
) {
  const taskByDay = new Map<string, number>();
  const pomodoroByDay = new Map<string, number>();
  const focusMinutesByDay = new Map<string, number>();
  const fitnessByDay = new Map<string, number>();

  for (const task of tasks) {
    if (!task.completedAt) continue;
    const key = toDateKey(new Date(task.completedAt));
    taskByDay.set(key, (taskByDay.get(key) ?? 0) + 1);
  }

  for (const session of pomodoros) {
    if (!session.endedAt || session.interrupted) continue;
    const key = toDateKey(new Date(session.endedAt));
    pomodoroByDay.set(key, (pomodoroByDay.get(key) ?? 0) + 1);
    focusMinutesByDay.set(key, (focusMinutesByDay.get(key) ?? 0) + session.focusDurationMin);
  }

  for (const entry of fitnessEntries) {
    const key = toDateKey(new Date(entry.loggedAt));
    fitnessByDay.set(key, (fitnessByDay.get(key) ?? 0) + entry.durationMinutes);
  }

  const points: Array<{
    date: string;
    label: string;
    tasksCompleted: number;
    pomodorosCompleted: number;
    focusMinutes: number;
    exerciseMinutes: number;
  }> = [];

  for (let index = 0; index < DAY_COUNT; index += 1) {
    const day = new Date(rangeStart.getTime() + index * MS_PER_DAY);
    const key = toDateKey(day);

    points.push({
      date: key,
      label: day.toLocaleDateString('es-ES', { weekday: 'short' }),
      tasksCompleted: taskByDay.get(key) ?? 0,
      pomodorosCompleted: pomodoroByDay.get(key) ?? 0,
      focusMinutes: focusMinutesByDay.get(key) ?? 0,
      exerciseMinutes: fitnessByDay.get(key) ?? 0,
    });
  }

  return points;
}

function sumFocusMinutes(sessions: DashboardSnapshot['pomodoroSessions']) {
  return sessions.reduce((sum, session) => sum + session.focusDurationMin, 0);
}

function buildWeekMetric(current: number, previous: number): DashboardWeekMetric {
  const delta = round(current - previous);
  const deltaPct = previous > 0 ? round((delta / previous) * 100) : current > 0 ? 100 : 0;

  return {
    current,
    previous,
    delta,
    deltaPct,
  };
}

function isWithinWeek(value: string | null | undefined, weekStart: Date): boolean {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  const start = weekStart.getTime();
  const end = start + 7 * MS_PER_DAY;
  const current = date.getTime();
  return current >= start && current < end;
}

function startOfWeek(day: Date): Date {
  const normalized = toStartOfDay(day);
  const dayNumber = normalized.getDay();
  const offset = dayNumber === 0 ? 6 : dayNumber - 1;
  return new Date(normalized.getTime() - offset * MS_PER_DAY);
}

function toStartOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function toDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
