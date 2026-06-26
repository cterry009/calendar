import { calculateFitnessProductivityCorrelation } from './fitness-correlation.js';

describe('fitness productivity correlation', () => {
  it('requires at least 14 days of data', () => {
    const report = calculateFitnessProductivityCorrelation(
      [{ date: '2026-06-01', tasksCompleted: 2, pomodorosCompleted: 1 }],
      [{ date: '2026-06-01', exerciseMinutes: 30 }],
    );

    expect(report.insight).toBe('insufficient_data');
  });

  it('detects higher productivity on exercise days', () => {
    const productivity = Array.from({ length: 14 }, (_, index) => ({
      date: `2026-06-${String(index + 1).padStart(2, '0')}`,
      tasksCompleted: index % 2 === 0 ? 6 : 2,
      pomodorosCompleted: index % 2 === 0 ? 4 : 1,
    }));

    const fitness = productivity.map((day, index) => ({
      date: day.date,
      exerciseMinutes: index % 2 === 0 ? 40 : 0,
    }));

    const report = calculateFitnessProductivityCorrelation(productivity, fitness);

    expect(report.insight).toBe('positive');
    expect(report.avgTasksOnExerciseDays).toBeGreaterThan(report.avgTasksOnRestDays);
  });
});
