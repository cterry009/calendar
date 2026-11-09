import { canEndFocus, MIN_FOCUS_TO_END } from './focusGuard.js';
import { createPomodoroSession } from './state-machine.js';

const NOW = Date.parse('2026-11-09T10:30:00-05:00');
const focus = (startedMinAgo: number, extra: object = {}) => ({
  ...createPomodoroSession('s1', { focusDurationMin: 30, shortBreakMin: 5, longBreakMin: 15, cyclesBeforeLongBreak: 4 }),
  state: 'FOCUS' as const,
  active: true,
  startedAt: new Date(NOW - startedMinAgo * 60_000).toISOString(),
  ...extra,
});

describe('canEndFocus', () => {
  it('uses 75 %', () => expect(MIN_FOCUS_TO_END).toBe(0.75));

  it('refuses 10 of 30 minutes and says how many are left', () => {
    expect(canEndFocus(focus(10), NOW)).toMatchObject({ allowed: false, minutesLeft: 13, plannedMin: 30 });
  });

  it('allows 23 of 30 (76 %)', () => {
    expect(canEndFocus(focus(23), NOW).allowed).toBe(true);
  });

  it('paused time does not count as focus', () => {
    // Started 25 min ago but paused 20 min ago: 5 min of focus.
    const paused = focus(25, { pausedAt: new Date(NOW - 20 * 60_000).toISOString() });
    expect(canEndFocus(paused, NOW)).toMatchObject({ allowed: false, minutesLeft: 18 });
  });

  it('pauses and idle sessions are not restricted', () => {
    expect(canEndFocus({ ...focus(1), state: 'SHORT_BREAK' }, NOW).allowed).toBe(true);
    expect(canEndFocus(createPomodoroSession('s2'), NOW).allowed).toBe(true);
  });
});
