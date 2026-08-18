import { computeHabitScore, createHabitScoreCurve, getCompletionTier } from './score.js';
import type { HabitScoreRecordInput } from './score.js';

function dateAt(day: number): string {
  // day 0 = 2026-01-01
  const d = new Date(Date.UTC(2026, 0, 1 + day));
  return d.toISOString();
}

function record(day: number, overrides: Partial<HabitScoreRecordInput> = {}): HabitScoreRecordInput {
  return {
    date: dateAt(day),
    value: 1,
    status: 'DONE',
    autoCompleted: false,
    ...overrides,
  };
}

describe('createHabitScoreCurve', () => {
  it('maps 0 consolidated days to score 0 and targetDays to score 100', () => {
    const curve = createHabitScoreCurve(30);
    expect(curve.toScore(0)).toBeCloseTo(0, 6);
    expect(curve.toScore(30)).toBeCloseTo(100, 6);
  });

  it('is monotonically increasing', () => {
    const curve = createHabitScoreCurve(30);
    const scores = [0, 5, 10, 15, 20, 25, 30].map((x) => curve.toScore(x));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThan(scores[i - 1]);
    }
  });

  it('toDays is the inverse of toScore', () => {
    const curve = createHabitScoreCurve(45);
    for (const days of [0, 10, 22.5, 45]) {
      expect(curve.toDays(curve.toScore(days))).toBeCloseTo(days, 4);
    }
  });
});

describe('getCompletionTier', () => {
  it('classifies NORMAL habits by comparing value to the goal', () => {
    expect(getCompletionTier('NORMAL', 15, 10)).toBe('GOODJOB');
    expect(getCompletionTier('NORMAL', 10, 10)).toBe('OK');
    expect(getCompletionTier('NORMAL', 4, 10)).toBe('TRYHARD');
    expect(getCompletionTier('NORMAL', 0, 10)).toBe('ZERO');
  });

  it('classifies NEGATIVE habits using a tolerance band between goal and extra', () => {
    // goal=2 (strict ceiling), extra=5 (tolerance ceiling)
    expect(getCompletionTier('NEGATIVE', 6, 2, 5)).toBe('TRYHARD'); // blew past tolerance
    expect(getCompletionTier('NEGATIVE', 5, 2, 5)).toBe('OK'); // exactly at tolerance
    expect(getCompletionTier('NEGATIVE', 3, 2, 5)).toBe('GOODJOB'); // within tolerated band
    expect(getCompletionTier('NEGATIVE', 2, 2, 5)).toBe('GOODJOB'); // exactly at strict goal
    expect(getCompletionTier('NEGATIVE', 0, 2, 5)).toBe('ZERO');
    expect(getCompletionTier('NEGATIVE', 1, 2, 5)).toBe('NO_EFFECT');
  });
});

describe('computeHabitScore', () => {
  it('stays at 0 for a freshly created habit with no records', () => {
    const score = computeHabitScore({
      type: 'NORMAL',
      targetDays: 30,
      dailyGoalValue: 1,
      createdAt: dateAt(0),
      records: [],
      asOf: dateAt(0),
    });
    expect(score).toBe(0);
  });

  it('never goes negative after a long gap with no records', () => {
    const score = computeHabitScore({
      type: 'NORMAL',
      targetDays: 30,
      dailyGoalValue: 1,
      createdAt: dateAt(0),
      records: [],
      asOf: dateAt(365),
    });
    expect(score).toBe(0);
  });

  it('increases with consistent daily check-ins and stays bounded at 100', () => {
    const targetDays = 20;
    const makeScore = (days: number) =>
      computeHabitScore({
        type: 'NORMAL',
        targetDays,
        dailyGoalValue: 1,
        createdAt: dateAt(0),
        records: Array.from({ length: days }, (_, i) => record(i + 1)),
        asOf: dateAt(days),
      });

    const early = makeScore(5);
    const mid = makeScore(15);
    const late = makeScore(60);

    expect(early).toBeGreaterThan(0);
    expect(mid).toBeGreaterThan(early);
    expect(late).toBe(100);
    for (const s of [early, mid, late]) {
      expect(s).toBeLessThanOrEqual(100);
    }
  });

  it('decays back down after a streak is abandoned', () => {
    const targetDays = 20;
    const streakRecords = Array.from({ length: 10 }, (_, i) => record(i + 1));

    const withStreakOnly = computeHabitScore({
      type: 'NORMAL',
      targetDays,
      dailyGoalValue: 1,
      createdAt: dateAt(0),
      records: streakRecords,
      asOf: dateAt(11),
    });

    const afterLongGap = computeHabitScore({
      type: 'NORMAL',
      targetDays,
      dailyGoalValue: 1,
      createdAt: dateAt(0),
      records: streakRecords,
      asOf: dateAt(11 + 200),
    });

    expect(afterLongGap).toBeLessThan(withStreakOnly);
    expect(afterLongGap).toBe(0);
  });

  it('treats an explicit SKIPPED day as neutral, unlike a silent gap', () => {
    const targetDays = 20;
    const base = Array.from({ length: 5 }, (_, i) => record(i + 1));

    const withSkip = computeHabitScore({
      type: 'NORMAL',
      targetDays,
      dailyGoalValue: 1,
      createdAt: dateAt(0),
      records: [...base, record(6, { status: 'SKIPPED', value: 0 })],
      asOf: dateAt(6),
    });

    const withSilentGap = computeHabitScore({
      type: 'NORMAL',
      targetDays,
      dailyGoalValue: 1,
      createdAt: dateAt(0),
      records: base,
      asOf: dateAt(6),
    });

    expect(withSkip).toBeGreaterThan(withSilentGap);
  });

  it('grants credit for an auto-completed record even at a partial value', () => {
    const targetDays = 20;

    const autoCompleted = computeHabitScore({
      type: 'NORMAL',
      targetDays,
      dailyGoalValue: 10,
      createdAt: dateAt(0),
      records: [record(1, { value: 0, autoCompleted: true })],
      asOf: dateAt(1),
    });

    const manual = computeHabitScore({
      type: 'NORMAL',
      targetDays,
      dailyGoalValue: 10,
      createdAt: dateAt(0),
      records: [record(1, { value: 0, autoCompleted: false })],
      asOf: dateAt(1),
    });

    expect(autoCompleted).toBeGreaterThan(0);
    expect(manual).toBe(0);
  });

  it('forgives mild lapses on a NEGATIVE habit within the tolerance band', () => {
    const targetDays = 20;

    const withinTolerance = computeHabitScore({
      type: 'NEGATIVE',
      targetDays,
      dailyGoalValue: 2,
      dailyGoalExtraValue: 5,
      createdAt: dateAt(0),
      records: [record(1, { value: 3 })],
      asOf: dateAt(1),
    });

    const blewPastTolerance = computeHabitScore({
      type: 'NEGATIVE',
      targetDays,
      dailyGoalValue: 2,
      dailyGoalExtraValue: 5,
      createdAt: dateAt(0),
      records: [record(1, { value: 6 })],
      asOf: dateAt(1),
    });

    expect(withinTolerance).toBeGreaterThan(blewPastTolerance);
    expect(blewPastTolerance).toBe(0);
  });
});
