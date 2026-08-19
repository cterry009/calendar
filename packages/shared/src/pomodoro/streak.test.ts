import { completedPomodoroDateKeys, computePomodoroStreak, DEFAULT_GRACE_DAYS } from './streak.js';

function iso(daysAgo: number, base: Date): string {
  const d = new Date(base);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

describe('completedPomodoroDateKeys', () => {
  const base = new Date('2026-08-19T12:00:00.000Z');

  it('excludes interrupted sessions', () => {
    const keys = completedPomodoroDateKeys([{ endedAt: iso(0, base), interrupted: true }]);
    expect(keys.size).toBe(0);
  });

  it('excludes sessions with no endedAt', () => {
    const keys = completedPomodoroDateKeys([{ endedAt: null, interrupted: false }]);
    expect(keys.size).toBe(0);
  });

  it('counts a clean, ended session', () => {
    const keys = completedPomodoroDateKeys([{ endedAt: iso(0, base), interrupted: false }]);
    expect(keys.size).toBe(1);
  });

  it('dedupes multiple sessions on the same day', () => {
    const keys = completedPomodoroDateKeys([
      { endedAt: base.toISOString(), interrupted: false },
      { endedAt: new Date(base.getTime() + 60 * 60 * 1000).toISOString(), interrupted: false },
    ]);
    expect(keys.size).toBe(1);
  });
});

describe('computePomodoroStreak', () => {
  const today = new Date('2026-08-19T18:00:00.000Z');

  it('is zero for no history', () => {
    const result = computePomodoroStreak(new Set(), { today });
    expect(result.currentStreak).toBe(0);
    expect(result.graceDaysUsed).toBe(0);
    expect(result.isActiveToday).toBe(false);
  });

  it('counts consecutive days ending today', () => {
    const keys = completedPomodoroDateKeys([
      { endedAt: iso(0, today), interrupted: false },
      { endedAt: iso(1, today), interrupted: false },
      { endedAt: iso(2, today), interrupted: false },
    ]);
    const result = computePomodoroStreak(keys, { today });
    expect(result.currentStreak).toBe(3);
    expect(result.isActiveToday).toBe(true);
    expect(result.graceDaysUsed).toBe(0);
  });

  it('still counts an ongoing streak when today has not been done yet', () => {
    const keys = completedPomodoroDateKeys([
      { endedAt: iso(1, today), interrupted: false },
      { endedAt: iso(2, today), interrupted: false },
    ]);
    const result = computePomodoroStreak(keys, { today });
    expect(result.currentStreak).toBe(2);
    expect(result.isActiveToday).toBe(false);
  });

  it('forgives a single missed day using a grace token instead of resetting', () => {
    // today done, yesterday MISSED, day before done, 3 days ago done
    const keys = completedPomodoroDateKeys([
      { endedAt: iso(0, today), interrupted: false },
      { endedAt: iso(2, today), interrupted: false },
      { endedAt: iso(3, today), interrupted: false },
    ]);
    const result = computePomodoroStreak(keys, { today });
    expect(result.currentStreak).toBe(3);
    expect(result.graceDaysUsed).toBe(1);
    expect(result.graceDaysRemaining).toBe(DEFAULT_GRACE_DAYS - 1);
  });

  it('breaks the streak once the grace pool is exhausted', () => {
    // today done, then 3 consecutive missed days (more than the 2-day grace pool), then an old streak
    const keys = completedPomodoroDateKeys([
      { endedAt: iso(0, today), interrupted: false },
      { endedAt: iso(4, today), interrupted: false },
      { endedAt: iso(5, today), interrupted: false },
    ]);
    const result = computePomodoroStreak(keys, { today, graceDays: 2 });
    expect(result.currentStreak).toBe(1);
    expect(result.graceDaysUsed).toBe(2);
    expect(result.graceDaysRemaining).toBe(0);
  });

  it('does not spend grace bridging into a streak from a cold start', () => {
    const keys = completedPomodoroDateKeys([{ endedAt: iso(5, today), interrupted: false }]);
    const result = computePomodoroStreak(keys, { today });
    expect(result.currentStreak).toBe(0);
    expect(result.graceDaysUsed).toBe(0);
  });

  it('respects a custom graceDays override', () => {
    const keys = completedPomodoroDateKeys([
      { endedAt: iso(0, today), interrupted: false },
      { endedAt: iso(4, today), interrupted: false },
    ]);
    const result = computePomodoroStreak(keys, { today, graceDays: 3 });
    expect(result.currentStreak).toBe(2);
    expect(result.graceDaysUsed).toBe(3);
    expect(result.graceDaysRemaining).toBe(0);
  });
});
