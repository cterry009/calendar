import { calculateEstimationAccuracy } from './estimation-accuracy.js';
import { calculateFitnessProductivityCorrelation } from './fitness-correlation.js';
import type {
  BlockEventMetric,
  DashboardBlockEventInput,
  DashboardFloorsClimbedInput,
  DashboardGameTimeInput,
  DashboardHabitInput,
  DashboardHabitRecordInput,
  DashboardMetrics,
  DashboardPomodoroInput,
  DashboardScreenTimeInput,
  DashboardSnapshot,
  DashboardStepCountInput,
  DashboardTaskInput,
  DashboardTrendPoint,
  DashboardWeekMetric,
  DeviceSensorMetric,
  GameTimeMetric,
  HabitCompletionMetric,
  ScreenTimeMetric,
} from './dashboard-types.js';
import type { TaskDifficulty } from '../schemas/enums.js';
import { computePomodoroStreak, dateKey as localDateKey } from '../pomodoro/streak.js';
import { isKnownDistractingApp } from '../screenTime/socialPackages.js';

// Task 8.1: promoted from apps/web's lib/analytics/aggregate.ts (the original) and
// apps/mobile's verbatim port -- the two had drifted into two independent copies (see tasks.md
// 6.2/8.1). `suggestions` is deliberately not part of this function's output: web's own
// DashboardMetrics carried a `suggestions` field computed here, but neither DashboardPage.tsx nor
// any other web consumer ever read it -- apps/web's actual suggestions panel (useSuggestions.ts)
// calls buildSuggestionInput/generateSuggestions directly, independent of this aggregator. Confirmed
// dead code before dropping it, not a silent behavior change; apps/mobile's copy never had the field
// at all, so this brings web in line with the version already proven correct on both platforms.
const DIFFICULTIES: TaskDifficulty[] = ['EASY', 'MEDIUM', 'HARD'];
const DAY_COUNT = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function buildDashboardMetrics(snapshot: DashboardSnapshot, now = new Date()): DashboardMetrics {
  const today = toStartOfDay(now);
  const currentWeekStart = startOfWeek(today);
  const previousWeekStart = new Date(currentWeekStart.getTime() - 7 * MS_PER_DAY);
  const rangeStart = new Date(currentWeekStart.getTime() - 7 * MS_PER_DAY);

  const completedTasks = snapshot.tasks.filter((task) => task.status === 'COMPLETED' && !!task.completedAt);
  const completedPomodoros = snapshot.pomodoroSessions.filter((session) => !session.interrupted && !!session.endedAt);

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

  const hasData = snapshot.tasks.length > 0 || snapshot.pomodoroSessions.length > 0 || snapshot.fitnessEntries.length > 0;

  // Task 8.4: the cross-platform metrics -- each degrades to an honest hasData:false instead of a
  // fake zero when its source array is absent/empty (a web-only account, a mobile account that
  // hasn't granted a given permission, etc.), per tasks.md 8.4's explicit requirement.
  const habitCompletion = computeHabitCompletion(snapshot.habits, snapshot.habitRecords, now);
  const deviceSensors = computeDeviceSensors(snapshot.dailyStepCounts, snapshot.dailyFloorsClimbed, rangeStart, now);
  const blockEvents = computeBlockEvents(snapshot.blockEvents, currentWeekStart, previousWeekStart, rangeStart);
  const screenTime = computeScreenTime(snapshot.dailyScreenTime, rangeStart, now);
  const gameTime = computeGameTime(snapshot.dailyGameTime, rangeStart, now);

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
    habitCompletion,
    deviceSensors,
    blockEvents,
    screenTime,
    gameTime,
  };
}

// Task 8.4. Builds the 14-day `date`/`label` skeleton every trend chart below shares (steps,
// floors, block-events) -- same day range buildDailyPoints already uses for focus hours, factored
// out since four different callers need the identical skeleton with a different value lookup.
function buildTrendSkeleton(rangeStart: Date, valueForDay: (dateKeyStr: string) => number): DashboardTrendPoint[] {
  return Array.from({ length: DAY_COUNT }, (_, index) => {
    const day = new Date(rangeStart.getTime() + index * MS_PER_DAY);
    const key = toDateKey(day);
    return { date: key, label: day.toLocaleDateString('es-ES', { weekday: 'short' }), value: valueForDay(key) };
  });
}

// Task 8.4. Reuses computePomodoroStreak's generic streak-walking logic (grace-day forgiveness,
// consecutive credited local-date keys) for habit check-ins instead of a second implementation --
// "credited" here means at least one habit marked DONE that day, mirroring how a pomodoro day is
// "credited" by at least one completed session.
function computeHabitCompletion(
  habits: DashboardHabitInput[] | undefined,
  habitRecords: DashboardHabitRecordInput[] | undefined,
  now: Date,
): HabitCompletionMetric {
  if (!habits || !habitRecords || habits.length === 0) {
    return { hasData: false, activeHabitCount: 0, completedToday: 0, currentStreak: 0 };
  }

  const activeHabitCount = habits.filter((habit) => !habit.archived).length;
  const todayKey = localDateKey(now);
  const doneDateKeys = new Set<string>();
  let completedToday = 0;

  for (const record of habitRecords) {
    if (record.status !== 'DONE') continue;
    const key = localDateKey(new Date(record.date));
    doneDateKeys.add(key);
    if (key === todayKey) completedToday += 1;
  }

  const { currentStreak } = computePomodoroStreak(doneDateKeys, { today: now });

  return { hasData: true, activeHabitCount, completedToday, currentStreak };
}

function computeDeviceSensors(
  stepCounts: DashboardStepCountInput[] | undefined,
  floorsClimbed: DashboardFloorsClimbedInput[] | undefined,
  rangeStart: Date,
  now: Date,
): DeviceSensorMetric {
  const hasData = !!(stepCounts?.length || floorsClimbed?.length);
  if (!hasData) {
    return { hasData: false, todaySteps: 0, todayFloors: 0, stepsByDay: [], floorsByDay: [] };
  }

  const stepsByDate = new Map<string, number>();
  for (const entry of stepCounts ?? []) stepsByDate.set(toDateKey(new Date(entry.date)), entry.steps);

  const floorsByDate = new Map<string, number>();
  for (const entry of floorsClimbed ?? []) floorsByDate.set(toDateKey(new Date(entry.date)), entry.floors);

  const todayKey = toDateKey(now);

  return {
    hasData: true,
    todaySteps: stepsByDate.get(todayKey) ?? 0,
    todayFloors: floorsByDate.get(todayKey) ?? 0,
    stepsByDay: buildTrendSkeleton(rangeStart, (key) => stepsByDate.get(key) ?? 0),
    floorsByDay: buildTrendSkeleton(rangeStart, (key) => floorsByDate.get(key) ?? 0),
  };
}

function computeBlockEvents(
  blockEvents: DashboardBlockEventInput[] | undefined,
  currentWeekStart: Date,
  previousWeekStart: Date,
  rangeStart: Date,
): BlockEventMetric {
  if (!blockEvents || blockEvents.length === 0) {
    const zero = buildWeekMetric(0, 0);
    return { hasData: false, blockedAttempts: zero, nightUnlocks: zero, blockedByDay: [] };
  }

  const blockedAttemptEvents = blockEvents.filter((event) => event.trigger === 'BLOCKED_OPEN_ATTEMPT');
  const nightUnlockEvents = blockEvents.filter((event) => event.trigger === 'NIGHT_UNLOCK');

  const blockedByDate = new Map<string, number>();
  for (const event of blockedAttemptEvents) {
    const key = toDateKey(new Date(event.occurredAt));
    blockedByDate.set(key, (blockedByDate.get(key) ?? 0) + 1);
  }

  const countWithinWeek = (events: DashboardBlockEventInput[], weekStart: Date) =>
    events.filter((event) => isWithinWeek(event.occurredAt, weekStart)).length;

  return {
    hasData: true,
    blockedAttempts: buildWeekMetric(
      countWithinWeek(blockedAttemptEvents, currentWeekStart),
      countWithinWeek(blockedAttemptEvents, previousWeekStart),
    ),
    nightUnlocks: buildWeekMetric(
      countWithinWeek(nightUnlockEvents, currentWeekStart),
      countWithinWeek(nightUnlockEvents, previousWeekStart),
    ),
    blockedByDay: buildTrendSkeleton(rangeStart, (key) => blockedByDate.get(key) ?? 0),
  };
}

// A day's "social minutes" is the sum of that day's topApps entries matching the curated social
// list (see socialPackages.ts's doc comment for why a subtotal derived from topApps, not a full
// per-app ledger the server never stores).
function socialMinutesForEntry(entry: DashboardScreenTimeInput | undefined): number {
  if (!entry) return 0;
  return entry.topApps
    .filter((app) => isKnownDistractingApp(app.packageName))
    .reduce((sum, app) => sum + app.minutes, 0);
}

function computeScreenTime(
  dailyScreenTime: DashboardScreenTimeInput[] | undefined,
  rangeStart: Date,
  now: Date,
): ScreenTimeMetric {
  if (!dailyScreenTime || dailyScreenTime.length === 0) {
    return {
      hasData: false,
      todayMinutes: 0,
      weekAverageMinutes: 0,
      byDay: [],
      topAppsToday: [],
      socialMinutesToday: 0,
      socialByDay: [],
    };
  }

  const byDate = new Map<string, DashboardScreenTimeInput>();
  for (const entry of dailyScreenTime) byDate.set(toDateKey(new Date(entry.date)), entry);

  const byDay = buildTrendSkeleton(rangeStart, (key) => byDate.get(key)?.totalMinutes ?? 0);
  const lastWeek = byDay.slice(-7);
  const weekAverageMinutes = lastWeek.length > 0 ? round(lastWeek.reduce((sum, point) => sum + point.value, 0) / 7) : 0;

  const socialByDay = buildTrendSkeleton(rangeStart, (key) => socialMinutesForEntry(byDate.get(key)));

  const todayEntry = byDate.get(toDateKey(now));

  return {
    hasData: true,
    todayMinutes: todayEntry?.totalMinutes ?? 0,
    weekAverageMinutes,
    byDay,
    topAppsToday: todayEntry?.topApps ?? [],
    socialMinutesToday: socialMinutesForEntry(todayEntry),
    socialByDay,
  };
}

// Windows desktop counterpart of computeScreenTime -- same shape/reasoning, see GameTimeMetric.
function computeGameTime(
  dailyGameTime: DashboardGameTimeInput[] | undefined,
  rangeStart: Date,
  now: Date,
): GameTimeMetric {
  if (!dailyGameTime || dailyGameTime.length === 0) {
    return { hasData: false, todayMinutes: 0, weekAverageMinutes: 0, byDay: [], topGamesToday: [] };
  }

  const byDate = new Map<string, DashboardGameTimeInput>();
  for (const entry of dailyGameTime) byDate.set(toDateKey(new Date(entry.date)), entry);

  const byDay = buildTrendSkeleton(rangeStart, (key) => byDate.get(key)?.totalMinutes ?? 0);
  const lastWeek = byDay.slice(-7);
  const weekAverageMinutes = lastWeek.length > 0 ? round(lastWeek.reduce((sum, point) => sum + point.value, 0) / 7) : 0;

  const todayEntry = byDate.get(toDateKey(now));

  return {
    hasData: true,
    todayMinutes: todayEntry?.totalMinutes ?? 0,
    weekAverageMinutes,
    byDay,
    topGamesToday: todayEntry?.topGames ?? [],
  };
}

function buildDailyPoints(
  tasks: DashboardTaskInput[],
  pomodoros: DashboardPomodoroInput[],
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

function sumFocusMinutes(sessions: DashboardPomodoroInput[]) {
  return sessions.reduce((sum, session) => sum + session.focusDurationMin, 0);
}

function buildWeekMetric(current: number, previous: number): DashboardWeekMetric {
  const delta = round(current - previous);
  const deltaPct = previous > 0 ? round((delta / previous) * 100) : current > 0 ? 100 : 0;

  return { current, previous, delta, deltaPct };
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
