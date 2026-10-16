import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NIGHT_END_MINUTES,
  DEFAULT_NIGHT_START_MINUTES,
  formatNightWindowMinutes,
  isWithinNightWindow,
  minutesUntilNightStart,
  nightWarningDue,
  parseNightTimeInput,
  validateNightWindow,
} from './nightWindow';

function atTime(hours: number, minutes: number): Date {
  const date = new Date(2026, 8, 18);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

describe('isWithinNightWindow', () => {
  it('is active well inside the default overnight window (23:00)', () => {
    expect(isWithinNightWindow(atTime(23, 0))).toBe(true);
  });

  it('is active just after midnight, before the window ends (03:00)', () => {
    expect(isWithinNightWindow(atTime(3, 0))).toBe(true);
  });

  it('is inactive during the day (14:00)', () => {
    expect(isWithinNightWindow(atTime(14, 0))).toBe(false);
  });

  it('is active exactly at the start boundary (22:00) but not one minute before', () => {
    expect(isWithinNightWindow(atTime(22, 0))).toBe(true);
    expect(isWithinNightWindow(atTime(21, 59))).toBe(false);
  });

  it('is inactive exactly at the end boundary (08:00) but active one minute before', () => {
    expect(isWithinNightWindow(atTime(8, 0))).toBe(false);
    expect(isWithinNightWindow(atTime(7, 59))).toBe(true);
  });

  it('supports a non-default, still-wrapping window', () => {
    expect(isWithinNightWindow(atTime(21, 0), 20 * 60, 6 * 60)).toBe(true);
    expect(isWithinNightWindow(atTime(19, 0), 20 * 60, 6 * 60)).toBe(false);
  });
});

describe('formatNightWindowMinutes', () => {
  it('formats the default window boundaries', () => {
    expect(formatNightWindowMinutes(DEFAULT_NIGHT_START_MINUTES)).toBe('22:00');
    expect(formatNightWindowMinutes(DEFAULT_NIGHT_END_MINUTES)).toBe('08:00');
  });
});

describe('parseNightTimeInput', () => {
  it('parses HH:MM', () => {
    expect(parseNightTimeInput('22:30')).toBe(22 * 60 + 30);
    expect(parseNightTimeInput(' 7:05 ')).toBe(7 * 60 + 5);
  });

  it('rejects anything else', () => {
    expect(parseNightTimeInput('24:00')).toBeNull();
    expect(parseNightTimeInput('22:60')).toBeNull();
    expect(parseNightTimeInput('2230')).toBeNull();
    expect(parseNightTimeInput('')).toBeNull();
  });
});

describe('validateNightWindow', () => {
  it('accepts the default window', () => {
    expect(validateNightWindow({ startMinutes: DEFAULT_NIGHT_START_MINUTES, endMinutes: DEFAULT_NIGHT_END_MINUTES }).ok).toBe(true);
  });

  it('rejects a window that does not cross midnight', () => {
    expect(validateNightWindow({ startMinutes: 8 * 60, endMinutes: 20 * 60 }).ok).toBe(false);
  });

  it('rejects a window shorter than 9.5 hours', () => {
    expect(validateNightWindow({ startMinutes: 23 * 60, endMinutes: 8 * 60 }).ok).toBe(false);
    expect(validateNightWindow({ startMinutes: 22 * 60, endMinutes: 8 * 60 }).ok).toBe(true);
  });
});

describe('isWithinNightWindow with a custom window', () => {
  it('follows the configured hours, not the default', () => {
    expect(isWithinNightWindow(atTime(21, 30), 21 * 60, 7 * 60)).toBe(true);
    expect(isWithinNightWindow(atTime(7, 30), 21 * 60, 7 * 60)).toBe(false);
  });
});

describe('nightWarningDue', () => {
  const settings = { enabled: true, window: { startMinutes: 22 * 60 + 30, endMinutes: 8 * 60 } };

  it('warns from 22:00, not before', () => {
    expect(nightWarningDue(atTime(21, 59), settings, null)).toBeNull();
    expect(nightWarningDue(atTime(22, 0), settings, null)).toBe(30);
  });

  it('waits 15 minutes between warnings', () => {
    const first = atTime(22, 0).getTime();
    expect(nightWarningDue(atTime(22, 10), settings, first)).toBeNull();
    expect(nightWarningDue(atTime(22, 15), settings, first)).toBe(15);
  });

  it('stops once the window has started (blocking takes over) and when night mode is off', () => {
    expect(nightWarningDue(atTime(22, 30), settings, null)).toBeNull();
    expect(nightWarningDue(atTime(22, 10), { ...settings, enabled: false }, null)).toBeNull();
  });

  it('wraps midnight for a window that starts after it', () => {
    expect(minutesUntilNightStart(atTime(23, 50), 20)).toBe(30);
  });
});
