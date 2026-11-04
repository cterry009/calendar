import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NIGHT_END_MINUTES,
  DEFAULT_NIGHT_START_MINUTES,
  formatNightWindowMinutes,
  nightWarningDue,
  parseNightTimeInput,
  validateNightWindow,
} from './nightWindow';

function atTime(hours: number, minutes: number): Date {
  const date = new Date(2026, 8, 18);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

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

  it('rejects a window shorter than 8 hours (2026-10-15)', () => {
    expect(validateNightWindow({ startMinutes: 23 * 60 + 30, endMinutes: 7 * 60 }).ok).toBe(false);
    expect(validateNightWindow({ startMinutes: 23 * 60, endMinutes: 7 * 60 }).ok).toBe(true);
    expect(validateNightWindow({ startMinutes: 22 * 60, endMinutes: 8 * 60 }).ok).toBe(true);
  });
});

describe('nightWarningDue', () => {
  const settings = { enabled: true, window: { startMinutes: 22 * 60 + 30, endMinutes: 8 * 60, weekendStartMinutes: 22 * 60 + 30 } };

  it('warns from 22:00, not before', () => {
    expect(nightWarningDue(atTime(21, 59), settings, null)).toBeNull();
    expect(nightWarningDue(atTime(22, 0), settings, null)?.minutesLeft).toBe(30);
  });

  it('waits 15 minutes between warnings', () => {
    const first = atTime(22, 0).getTime();
    expect(nightWarningDue(atTime(22, 10), settings, first)).toBeNull();
    expect(nightWarningDue(atTime(22, 15), settings, first)?.minutesLeft).toBe(15);
  });

  it('stops once the window has started (blocking takes over) and when night mode is off', () => {
    expect(nightWarningDue(atTime(22, 30), settings, null)).toBeNull();
    expect(nightWarningDue(atTime(22, 10), { ...settings, enabled: false }, null)).toBeNull();
  });

  // atTime is a Friday: the general block starts at midnight (weekend-mode).
  it('warns before midnight on a Friday, and about an app with its own start', () => {
    const friday = { ...settings, window: { ...settings.window, weekendStartMinutes: 0 } };
    expect(nightWarningDue(atTime(22, 0), friday, null)).toBeNull();
    expect(nightWarningDue(atTime(23, 30), friday, null)).toMatchObject({ minutesLeft: 30, labels: [null] });
    const lol = { label: 'League of Legends', override: { weekendNightStartMinutes: 22 * 60 } };
    expect(nightWarningDue(atTime(21, 45), friday, null, [{ label: null }, lol])).toMatchObject({
      minutesLeft: 15,
      labels: ['League of Legends'],
    });
  });
});
