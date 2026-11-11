import { describe, expect, it } from 'vitest';
import { goalsToday, goalsWeek, motivation } from './goals';

const now = new Date(2026, 10, 11, 15, 0); // Wednesday
const input = {
  habits: [{ id: 'h', archived: false, type: 'NORMAL', dailyGoalValue: 1 }],
  habitRecords: [{ habitId: 'h', date: '2026-11-11', value: 1 }],
  schedules: [{ id: 's', enabled: true, kind: 'WORK', daysOfWeek: [1, 2, 3] }],
  scheduleCompletions: [],
  pomodoroSessions: [{ scheduleId: 's', startedAt: new Date(2026, 10, 11, 9).toISOString(), completedCycles: 2 }],
  tasks: [{ id: 't', deletedAt: null, status: 'PENDING', scheduledAt: new Date(2026, 10, 11, 10).toISOString(), completedAt: null }],
} as never;

describe('goals', () => {
  it('counts habits at goal, blocks with focus and tasks due today', () => {
    expect(goalsToday(input, now)).toEqual({ done: 2, total: 3 });
  });
  it('adds Monday to today for the week', () => {
    expect(goalsWeek(input, now)).toEqual({ done: 2, total: 7 }); // Mon and Tue: habit + block; Wed: habit + block + task
  });
  it('picks a line by ratio', () => {
    expect(['Sigue así.', 'Buen ritmo: mantenlo.', 'Vas muy bien hoy.']).toContain(motivation({ done: 8, total: 10 }, now));
    expect(motivation({ done: 0, total: 0 }, now)).toMatch(/constancia|pequeño|corto/);
  });
});
