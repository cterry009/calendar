import {
  calculateEstimationAccuracy,
  calculateEstimationErrorPct,
} from './estimation-accuracy.js';

describe('estimation accuracy', () => {
  it('calculates overrun percentage', () => {
    expect(calculateEstimationErrorPct(60, 75)).toBe(25);
  });

  it('groups accuracy by difficulty', () => {
    const report = calculateEstimationAccuracy([
      { difficulty: 'HARD', estimatedMinutes: 60, actualMinutes: 80 },
      { difficulty: 'HARD', estimatedMinutes: 60, actualMinutes: 78 },
      { difficulty: 'HARD', estimatedMinutes: 60, actualMinutes: 82 },
      { difficulty: 'HARD', estimatedMinutes: 60, actualMinutes: 79 },
      { difficulty: 'HARD', estimatedMinutes: 60, actualMinutes: 81 },
      { difficulty: 'EASY', estimatedMinutes: 30, actualMinutes: 28 },
    ]);

    expect(report.byDifficulty.HARD.count).toBe(5);
    expect(report.byDifficulty.HARD.tendency).toBe('underestimate');
    expect(report.byDifficulty.HARD.avgErrorPct).toBeGreaterThan(20);
  });
});
