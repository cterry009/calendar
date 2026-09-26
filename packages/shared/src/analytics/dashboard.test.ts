import { buildDashboardMetrics } from './dashboard.js';
import type { DashboardSnapshot } from './dashboard-types.js';

const EMPTY_SNAPSHOT: DashboardSnapshot = { tasks: [], pomodoroSessions: [], fitnessEntries: [] };

describe('buildDashboardMetrics', () => {
  it('reports no data for an empty snapshot', () => {
    const metrics = buildDashboardMetrics(EMPTY_SNAPSHOT, new Date('2026-06-15T12:00:00Z'));

    expect(metrics.hasData).toBe(false);
    expect(metrics.tasksCompleted).toEqual({ current: 0, previous: 0, delta: 0, deltaPct: 0 });
    expect(metrics.focusByDay).toHaveLength(14);
  });

  it('counts a completed task/pomodoro/fitness entry in the current week', () => {
    const now = new Date('2026-06-17T12:00:00Z'); // Wednesday
    const snapshot: DashboardSnapshot = {
      tasks: [
        {
          status: 'COMPLETED',
          completedAt: '2026-06-16T09:00:00Z',
          difficulty: 'MEDIUM',
          estimatedMinutes: 30,
          actualMinutes: 45,
        },
      ],
      pomodoroSessions: [
        {
          interrupted: false,
          startedAt: '2026-06-16T09:00:00Z',
          endedAt: '2026-06-16T09:25:00Z',
          focusDurationMin: 25,
        },
      ],
      fitnessEntries: [{ loggedAt: '2026-06-16T18:00:00Z', durationMinutes: 30 }],
    };

    const metrics = buildDashboardMetrics(snapshot, now);

    expect(metrics.hasData).toBe(true);
    expect(metrics.tasksCompleted.current).toBe(1);
    expect(metrics.pomodorosCompleted.current).toBe(1);
    expect(metrics.estimatedVsActual).toEqual({
      estimatedMinutes: 30,
      actualMinutes: 45,
      varianceMinutes: 15,
      variancePct: 50,
    });
    expect(metrics.completionByDifficulty.find((d) => d.difficulty === 'MEDIUM')?.completed).toBe(1);
  });

  it('does not put a task completed last week into the current-week count', () => {
    const now = new Date('2026-06-17T12:00:00Z'); // Wednesday
    const snapshot: DashboardSnapshot = {
      tasks: [
        {
          status: 'COMPLETED',
          completedAt: '2026-06-05T09:00:00Z',
          difficulty: 'EASY',
          estimatedMinutes: 20,
          actualMinutes: 20,
        },
      ],
      pomodoroSessions: [],
      fitnessEntries: [],
    };

    const metrics = buildDashboardMetrics(snapshot, now);

    expect(metrics.tasksCompleted.current).toBe(0);
    expect(metrics.tasksCompleted.previous).toBe(0);
  });

  it('reports hasData:false for every cross-platform metric on an empty snapshot', () => {
    const metrics = buildDashboardMetrics(EMPTY_SNAPSHOT, new Date('2026-06-15T12:00:00Z'));

    expect(metrics.habitCompletion).toEqual({ hasData: false, activeHabitCount: 0, completedToday: 0, currentStreak: 0 });
    expect(metrics.deviceSensors.hasData).toBe(false);
    expect(metrics.blockEvents.hasData).toBe(false);
    expect(metrics.screenTime.hasData).toBe(false);
    expect(metrics.gameTime.hasData).toBe(false);
  });

  it('computes habit completion rate and a two-day streak from check-in records', () => {
    const now = new Date('2026-06-17T12:00:00Z'); // Wednesday
    const snapshot: DashboardSnapshot = {
      ...EMPTY_SNAPSHOT,
      habits: [{ archived: false }, { archived: false }, { archived: true }],
      habitRecords: [
        { date: '2026-06-16T12:00:00Z', status: 'DONE' },
        { date: '2026-06-17T12:00:00Z', status: 'DONE' },
        { date: '2026-06-17T12:00:00Z', status: 'SKIPPED' },
      ],
    };

    const metrics = buildDashboardMetrics(snapshot, now);

    expect(metrics.habitCompletion).toEqual({
      hasData: true,
      activeHabitCount: 2,
      completedToday: 1,
      currentStreak: 2,
    });
  });

  it('surfaces today\'s steps/floors and a 14-day trend from device-sensor rows', () => {
    const now = new Date('2026-06-17T12:00:00Z');
    const snapshot: DashboardSnapshot = {
      ...EMPTY_SNAPSHOT,
      dailyStepCounts: [
        { date: '2026-06-16T00:00:00Z', steps: 4000 },
        { date: '2026-06-17T00:00:00Z', steps: 6500 },
      ],
      dailyFloorsClimbed: [{ date: '2026-06-17T00:00:00Z', floors: 3 }],
    };

    const metrics = buildDashboardMetrics(snapshot, now);

    expect(metrics.deviceSensors.hasData).toBe(true);
    expect(metrics.deviceSensors.todaySteps).toBe(6500);
    expect(metrics.deviceSensors.todayFloors).toBe(3);
    expect(metrics.deviceSensors.stepsByDay).toHaveLength(14);
    expect(metrics.deviceSensors.stepsByDay.find((p) => p.date === '2026-06-16')?.value).toBe(4000);
  });

  it('splits block events into this-week/last-week counts by trigger', () => {
    const now = new Date('2026-06-17T12:00:00Z'); // Wednesday
    const snapshot: DashboardSnapshot = {
      ...EMPTY_SNAPSHOT,
      blockEvents: [
        { occurredAt: '2026-06-16T09:00:00Z', trigger: 'BLOCKED_OPEN_ATTEMPT' },
        { occurredAt: '2026-06-16T09:05:00Z', trigger: 'BLOCKED_OPEN_ATTEMPT' },
        { occurredAt: '2026-06-16T06:00:00Z', trigger: 'NIGHT_UNLOCK' },
        { occurredAt: '2026-06-10T09:00:00Z', trigger: 'BLOCKED_OPEN_ATTEMPT' }, // previous week (weeks start Monday; now=Wed Jun 17 -> current week starts Jun 15, previous Jun 8)
      ],
    };

    const metrics = buildDashboardMetrics(snapshot, now);

    expect(metrics.blockEvents.hasData).toBe(true);
    expect(metrics.blockEvents.blockedAttempts).toEqual({ current: 2, previous: 1, delta: 1, deltaPct: 100 });
    expect(metrics.blockEvents.nightUnlocks.current).toBe(1);
    expect(metrics.blockEvents.blockedByDay.find((p) => p.date === '2026-06-16')?.value).toBe(2);
  });

  it('computes today\'s screen time, a 7-day average, and passes through top apps', () => {
    const now = new Date('2026-06-17T12:00:00Z');
    const snapshot: DashboardSnapshot = {
      ...EMPTY_SNAPSHOT,
      dailyScreenTime: [
        { date: '2026-06-17T00:00:00Z', totalMinutes: 120, topApps: [{ packageName: 'com.reddit.frontpage', minutes: 80 }] },
      ],
    };

    const metrics = buildDashboardMetrics(snapshot, now);

    expect(metrics.screenTime.hasData).toBe(true);
    expect(metrics.screenTime.todayMinutes).toBe(120);
    expect(metrics.screenTime.weekAverageMinutes).toBeCloseTo(17.1, 5); // round(120/7) to 1 decimal, matching dashboard.ts's own round()
    expect(metrics.screenTime.topAppsToday).toEqual([{ packageName: 'com.reddit.frontpage', minutes: 80 }]);
    // com.reddit.frontpage is on the curated social list -- the whole 80 minutes count as social.
    expect(metrics.screenTime.socialMinutesToday).toBe(80);
  });

  it('sums only the social-app minutes into the "redes sociales" subtotal, excluding WhatsApp', () => {
    const now = new Date('2026-06-17T12:00:00Z');
    const snapshot: DashboardSnapshot = {
      ...EMPTY_SNAPSHOT,
      dailyScreenTime: [
        {
          date: '2026-06-17T00:00:00Z',
          totalMinutes: 200,
          topApps: [
            { packageName: 'com.google.android.youtube', minutes: 60 }, // social
            { packageName: 'com.instagram.android', minutes: 40 }, // social
            { packageName: 'com.whatsapp', minutes: 90 }, // deliberately not social
            { packageName: 'com.android.chrome', minutes: 10 }, // not social
          ],
        },
      ],
    };

    const metrics = buildDashboardMetrics(snapshot, now);

    expect(metrics.screenTime.socialMinutesToday).toBe(100);
    expect(metrics.screenTime.socialByDay.find((p) => p.date === '2026-06-17')?.value).toBe(100);
  });

  it('reports gameTime.hasData:false on an empty snapshot and computes today/week/top games otherwise', () => {
    const empty = buildDashboardMetrics(EMPTY_SNAPSHOT, new Date('2026-06-15T12:00:00Z'));
    expect(empty.gameTime).toEqual({ hasData: false, todayMinutes: 0, weekAverageMinutes: 0, byDay: [], topGamesToday: [] });

    const now = new Date('2026-06-17T12:00:00Z');
    const snapshot: DashboardSnapshot = {
      ...EMPTY_SNAPSHOT,
      dailyGameTime: [
        {
          date: '2026-06-17T00:00:00Z',
          totalMinutes: 90,
          topGames: [{ key: '730', label: 'Counter-Strike 2', minutes: 90, source: 'STEAM' }],
        },
      ],
    };

    const metrics = buildDashboardMetrics(snapshot, now);

    expect(metrics.gameTime.hasData).toBe(true);
    expect(metrics.gameTime.todayMinutes).toBe(90);
    expect(metrics.gameTime.weekAverageMinutes).toBeCloseTo(12.9, 5);
    expect(metrics.gameTime.topGamesToday).toEqual([{ key: '730', label: 'Counter-Strike 2', minutes: 90, source: 'STEAM' }]);
  });
});
