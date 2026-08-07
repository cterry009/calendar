import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FOCUS_PLAN_CONFIG,
  availableFocusMinutes,
  computeEndMinuteForConfig,
  computeMaxChunks,
  countSegmentsByType,
  estimateFocusDurationMin,
  estimateLongBreakMin,
  estimateShortBreakMin,
  generateFocusPlan,
  loadFocusFeedbackHistory,
  recordFocusFeedbackSample,
  requiredMinutesForConfig,
  resolveFocusPlanConfig,
} from './planner';

describe('availableFocusMinutes', () => {
  it('returns the full range when it does not touch the lunch window', () => {
    expect(availableFocusMinutes(9 * 60, 11 * 60)).toBe(120);
  });

  it('subtracts the overlap with the fixed lunch window', () => {
    // 09:00-13:00 overlaps the 12:30-13:30 lunch window by 30 minutes.
    expect(availableFocusMinutes(9 * 60, 13 * 60)).toBe(240 - 30);
  });

  it('never goes negative when fully inside the excluded window', () => {
    expect(availableFocusMinutes(12 * 60 + 40, 13 * 60)).toBe(0);
  });
});

describe('estimateShortBreakMin', () => {
  it('scales from the minimum pomodoro length to the minimum short break', () => {
    expect(estimateShortBreakMin(30)).toBe(5);
  });

  it('scales from the maximum pomodoro length to the maximum short break', () => {
    expect(estimateShortBreakMin(45)).toBe(10);
  });

  it('interpolates and rounds midpoints', () => {
    expect(estimateShortBreakMin(37.5)).toBe(8);
  });
});

describe('estimateLongBreakMin', () => {
  it('returns the minimum for a typically short chunk', () => {
    expect(estimateLongBreakMin(30, 3)).toBe(30);
  });

  it('returns the maximum for a typically long chunk', () => {
    expect(estimateLongBreakMin(45, 6)).toBe(60);
  });

  it('scales for an in-between chunk', () => {
    expect(estimateLongBreakMin(30, 4)).toBe(35);
  });
});

describe('requiredMinutesForConfig', () => {
  it('sums pomodoros, short breaks within chunks, and long breaks between chunks', () => {
    const minutes = requiredMinutesForConfig({
      pomodoroMin: 25,
      shortBreakMin: 5,
      longBreakMin: 15,
      pomodorosPerChunk: 4,
      chunks: 2,
    });
    // chunkLength = 4*25 + 3*5 = 115; total = 2*115 + 15 = 245
    expect(minutes).toBe(245);
  });
});

describe('computeMaxChunks', () => {
  const config = { pomodoroMin: 25, shortBreakMin: 5, longBreakMin: 15, pomodorosPerChunk: 4 };

  it('fits as many chunks as the available time allows', () => {
    expect(computeMaxChunks(250, config)).toBe(2);
  });

  it('returns 0 when not even one chunk fits', () => {
    expect(computeMaxChunks(100, config)).toBe(0);
  });

  it('is capped at MAX_CHUNKS regardless of how much time is available', () => {
    expect(computeMaxChunks(10_000, config)).toBe(5);
  });
});

describe('generateFocusPlan', () => {
  it('builds a full chunk of alternating pomodoros and short breaks that fits before the lunch window', () => {
    const plan = generateFocusPlan(9 * 60, 13 * 60, DEFAULT_FOCUS_PLAN_CONFIG);

    expect(countSegmentsByType(plan, 'pomodoro')).toBe(4);
    expect(countSegmentsByType(plan, 'short-break')).toBe(3);
    expect(countSegmentsByType(plan, 'long-break')).toBe(0);

    const excluded = plan.filter((segment) => segment.type === 'excluded');
    expect(excluded).toEqual([{ type: 'excluded', startMinute: 12 * 60 + 30, endMinute: 13 * 60 }]);

    // No real segment should overlap the lunch window.
    const realSegments = plan.filter((segment) => segment.type !== 'excluded');
    for (const segment of realSegments) {
      expect(segment.endMinute).toBeLessThanOrEqual(12 * 60 + 30);
    }
  });

  it('never returns a segment past the requested end time', () => {
    const plan = generateFocusPlan(9 * 60, 13 * 60, DEFAULT_FOCUS_PLAN_CONFIG);
    for (const segment of plan) {
      expect(segment.endMinute).toBeLessThanOrEqual(13 * 60);
      expect(segment.startMinute).toBeGreaterThanOrEqual(9 * 60);
    }
  });

  it('falls back to greedily packed pomodoros when no full chunk fits, and still skips the lunch window', () => {
    // 12:15-14:10: too little available time (after lunch) for one full default chunk.
    const plan = generateFocusPlan(12 * 60 + 15, 14 * 60 + 10, DEFAULT_FOCUS_PLAN_CONFIG);

    expect(plan).toEqual([
      { type: 'excluded', startMinute: 12 * 60 + 30, endMinute: 13 * 60 + 30 },
      { type: 'pomodoro', startMinute: 13 * 60 + 30, endMinute: 14 * 60 },
    ]);
  });

  it('returns only the excluded window when the range is shorter than one pomodoro', () => {
    const plan = generateFocusPlan(9 * 60, 9 * 60 + 10, DEFAULT_FOCUS_PLAN_CONFIG);
    expect(plan).toEqual([]);
  });

  it('reports the excluded window even for a too-short range that covers it', () => {
    const plan = generateFocusPlan(12 * 60 + 40, 12 * 60 + 50, DEFAULT_FOCUS_PLAN_CONFIG);
    expect(plan).toEqual([{ type: 'excluded', startMinute: 12 * 60 + 40, endMinute: 12 * 60 + 50 }]);
  });
});

describe('computeEndMinuteForConfig', () => {
  it('matches the end of the last segment generateFocusPlan would produce for the same config', () => {
    const config = { ...DEFAULT_FOCUS_PLAN_CONFIG, chunks: 1 };
    const end = computeEndMinuteForConfig(9 * 60, config);

    const plan = generateFocusPlan(9 * 60, end, config);
    const lastReal = plan.filter((s) => s.type !== 'excluded').at(-1);

    expect(lastReal?.endMinute).toBe(end);
  });
});

describe('resolveFocusPlanConfig', () => {
  it('derives every field from defaults/estimation when the schedule has none stored', () => {
    const config = resolveFocusPlanConfig({
      startMinute: 9 * 60,
      endMinute: 13 * 60,
      pomodoroMin: null,
      shortBreakMin: null,
      longBreakMin: null,
      pomodorosPerChunk: null,
      chunks: null,
    });

    expect(config).toEqual({
      pomodoroMin: 30,
      shortBreakMin: 5,
      longBreakMin: 35,
      pomodorosPerChunk: 4,
      chunks: 1,
    });
  });

  it('uses stored values as-is without recomputing them', () => {
    const config = resolveFocusPlanConfig({
      startMinute: 0,
      endMinute: 100,
      pomodoroMin: 50,
      shortBreakMin: 9,
      longBreakMin: 40,
      pomodorosPerChunk: 3,
      chunks: 2,
    });

    expect(config).toEqual({
      pomodoroMin: 50,
      shortBreakMin: 9,
      longBreakMin: 40,
      pomodorosPerChunk: 3,
      chunks: 2,
    });
  });
});

describe('estimateFocusDurationMin (no window/localStorage available)', () => {
  it('falls back to the default with no history', () => {
    expect(estimateFocusDurationMin([])).toBe(30);
  });

  it('averages the most recent samples within the sample window', () => {
    // window is 8; only the last 8 of these 9 values should count.
    expect(estimateFocusDurationMin([1000, 25, 30, 35, 40, 45, 50, 55, 60])).toBe(43);
  });

  it('clamps the average to the allowed [30, 45] range', () => {
    expect(estimateFocusDurationMin([10, 10, 10])).toBe(30);
    expect(estimateFocusDurationMin([100, 100])).toBe(45);
  });

  it('does not throw when localStorage/window is unavailable', () => {
    expect(loadFocusFeedbackHistory()).toEqual([]);
    expect(() => recordFocusFeedbackSample(30)).not.toThrow();
  });
});
