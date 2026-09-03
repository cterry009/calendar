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
});
