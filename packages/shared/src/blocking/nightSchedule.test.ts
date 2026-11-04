import {
  isInNightWindow,
  isNightStartNoLater,
  minutesUntilNextNightStart,
  nightStartForDay,
  nightWarningSubject,
  upcomingNightStart,
  validateNightStart,
} from './nightSchedule.js';

const WINDOW = { startMinutes: 22 * 60, endMinutes: 8 * 60, weekendStartMinutes: 0 };
const LOL = { nightStartMinutes: 20 * 60, weekendNightStartMinutes: 22 * 60 };
const DISCORD = { nightStartMinutes: 22 * 60, weekendNightStartMinutes: 22 * 60 };

// 2026-11-02 is a Monday; 11-06 Friday, 11-07 Saturday, 11-08 Sunday.
function at(day: number, hour: number, minute = 0): Date {
  return new Date(2026, 10, day, hour, minute);
}

describe('nightStartForDay', () => {
  it('uses the weekday start Sunday to Thursday and the weekend start Friday and Saturday', () => {
    expect([0, 1, 2, 3, 4].map((d) => nightStartForDay(d, WINDOW))).toEqual([1320, 1320, 1320, 1320, 1320]);
    expect([5, 6].map((d) => nightStartForDay(d, WINDOW))).toEqual([0, 0]);
  });

  it('defaults the weekend start to midnight on a window saved before it existed', () => {
    expect(nightStartForDay(5, { startMinutes: 1320, endMinutes: 480 })).toBe(0);
  });

  it('takes an entry override over the window', () => {
    expect(nightStartForDay(1, WINDOW, LOL)).toBe(1200);
    expect(nightStartForDay(6, WINDOW, LOL)).toBe(1320);
    expect(nightStartForDay(1, WINDOW, { nightStartMinutes: null })).toBe(1320);
  });
});

describe('isInNightWindow', () => {
  it('blocks a weeknight from 22:00 and a weekend night only from midnight', () => {
    expect(isInNightWindow(at(2, 21, 59), WINDOW)).toBe(false);
    expect(isInNightWindow(at(2, 22), WINDOW)).toBe(true);
    expect(isInNightWindow(at(6, 23, 30), WINDOW)).toBe(false);
    expect(isInNightWindow(at(7, 0, 0), WINDOW)).toBe(true);
    expect(isInNightWindow(at(7, 7, 59), WINDOW)).toBe(true);
    expect(isInNightWindow(at(7, 8), WINDOW)).toBe(false);
    expect(isInNightWindow(at(7, 23), WINDOW)).toBe(false);
    // Sunday night is a school night again.
    expect(isInNightWindow(at(8, 22, 30), WINDOW)).toBe(true);
  });

  it('blocks League of Legends from 20:00 on a weeknight and 22:00 on Friday', () => {
    expect(isInNightWindow(at(3, 20), WINDOW, LOL)).toBe(true);
    expect(isInNightWindow(at(3, 19, 59), WINDOW, LOL)).toBe(false);
    expect(isInNightWindow(at(6, 21), WINDOW, LOL)).toBe(false);
    expect(isInNightWindow(at(6, 22), WINDOW, LOL)).toBe(true);
  });

  it('blocks Discord from 22:00 on Saturday too', () => {
    expect(isInNightWindow(at(7, 22, 15), WINDOW, DISCORD)).toBe(true);
  });
});

describe('minutesUntilNextNightStart', () => {
  it('counts to tonight 22:00, or to midnight on a weekend night', () => {
    expect(minutesUntilNextNightStart(at(2, 21, 30), WINDOW)).toBe(30);
    expect(minutesUntilNextNightStart(at(6, 23, 30), WINDOW)).toBe(30);
  });

  it('skips past a night already started', () => {
    // Monday 22:10: the next start is Tuesday 22:00.
    expect(minutesUntilNextNightStart(at(2, 22, 10), WINDOW)).toBe(23 * 60 + 50);
  });
});

describe('upcomingNightStart', () => {
  const targets = [
    { label: null },
    { label: 'League of Legends', override: LOL },
    { label: 'Discord', override: DISCORD },
  ];

  it('warns about League of Legends alone at 19:30 on a weeknight', () => {
    expect(upcomingNightStart(at(3, 19, 30), WINDOW, targets)).toEqual({
      minutesLeft: 30,
      start: 1200,
      labels: ['League of Legends'],
    });
  });

  it('groups everything starting at 22:00 on a weeknight', () => {
    expect(upcomingNightStart(at(3, 21, 45), WINDOW, targets)?.labels).toEqual([null, 'Discord']);
  });

  it('warns about the general block at 23:30 on Friday', () => {
    expect(upcomingNightStart(at(6, 23, 30), WINDOW, targets)).toEqual({ minutesLeft: 30, start: 0, labels: [null] });
  });

  it('is quiet with nothing within half an hour', () => {
    expect(upcomingNightStart(at(3, 18), WINDOW, targets)).toBeNull();
  });
});

describe('validateNightStart', () => {
  it('accepts the evening and midnight only', () => {
    expect(validateNightStart(20 * 60).ok).toBe(true);
    expect(validateNightStart(0).ok).toBe(true);
    expect(validateNightStart(17 * 60).ok).toBe(false);
    expect(validateNightStart(1440).ok).toBe(false);
  });
});

describe('isNightStartNoLater', () => {
  it('treats midnight as the latest start', () => {
    expect(isNightStartNoLater(22 * 60, 0, 1320)).toBe(true);
    expect(isNightStartNoLater(0, 22 * 60, 1320)).toBe(false);
    expect(isNightStartNoLater(null, 20 * 60, 1320)).toBe(false);
    expect(isNightStartNoLater(19 * 60, null, 1320)).toBe(true);
  });
});

describe('nightWarningSubject', () => {
  it('names the general block or the apps', () => {
    expect(nightWarningSubject([null])).toBe('las redes sociales y los juegos');
    expect(nightWarningSubject(['League of Legends', 'Discord'])).toBe('League of Legends y Discord');
  });
});
