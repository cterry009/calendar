import { describe, expect, it } from 'vitest';
import { buildEventsForRange } from '../calendar/utils';
import type { SyncHabit } from '../calendar/types';
import { describeTimeBlock, parseTimeInput, timeBlockRange, validateTimeBlock } from './timeBlock';
import { dateKey } from './today';

function habit(overrides: Partial<SyncHabit>): SyncHabit {
  return {
    id: 'h1',
    clientId: null,
    title: 'Deporte',
    description: null,
    type: 'NORMAL',
    dailyGoalValue: 1,
    dailyGoalUnit: 'vez',
    dailyGoalExtraValue: null,
    targetDays: 66,
    color: null,
    category: null,
    archived: false,
    linkedFitnessActivityType: null,
    reminderStartMinute: null,
    reminderEndMinute: null,
    reminderDaysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

const EMPTY = { tasks: [], schedules: [], pomodoroSessions: [], fitnessEntries: [] };
// 2026-09-28 is a Monday, 2026-09-27 a Sunday.
const monday = new Date(2026, 8, 28);

describe('parseTimeInput', () => {
  it('parses, allows empty, rejects garbage', () => {
    expect(parseTimeInput('07:30')).toBe(450);
    expect(parseTimeInput('')).toBeNull();
    expect(parseTimeInput('25:00')).toBeUndefined();
    expect(parseTimeInput('7h')).toBeUndefined();
  });
});

describe('validateTimeBlock', () => {
  it('accepts no block, a window, and a deadline', () => {
    expect(validateTimeBlock(null, null, [])).toBeNull();
    expect(validateTimeBlock(420, 480, [1])).toBeNull();
    expect(validateTimeBlock(null, 420, [1])).toBeNull();
  });

  it('rejects a start without an end, an inverted window, and no days', () => {
    expect(validateTimeBlock(420, null, [1])).not.toBeNull();
    expect(validateTimeBlock(480, 420, [1])).not.toBeNull();
    expect(validateTimeBlock(420, 480, [])).not.toBeNull();
  });
});

describe('timeBlockRange / describeTimeBlock', () => {
  it('uses the window as is', () => {
    const h = habit({ reminderStartMinute: 420, reminderEndMinute: 480 });
    expect(timeBlockRange(h)).toEqual({ start: 420, end: 480 });
    expect(describeTimeBlock(h)).toBe('07:00-08:00');
  });

  it('turns a deadline into a short block ending at it', () => {
    const h = habit({ reminderEndMinute: 420 });
    expect(timeBlockRange(h)).toEqual({ start: 405, end: 420 });
    expect(describeTimeBlock(h)).toBe('antes de las 07:00');
  });
});

describe('habits on the calendar', () => {
  it('shows a habit with a block on the days it applies to', () => {
    const events = buildEventsForRange(
      { ...EMPTY, habits: [habit({ reminderStartMinute: 420, reminderEndMinute: 480, reminderDaysOfWeek: [1] })] },
      monday,
      monday,
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'habit', title: 'Deporte' });
    expect(events[0].start.getHours()).toBe(7);
    expect(events[0].end.getHours()).toBe(8);
  });

  it('skips other days, habits without a block, and archived habits', () => {
    const sunday = new Date(2026, 8, 27);
    const events = buildEventsForRange(
      {
        ...EMPTY,
        habits: [
          habit({ id: 'a', reminderStartMinute: 420, reminderEndMinute: 480, reminderDaysOfWeek: [1] }),
          habit({ id: 'b' }),
          habit({ id: 'c', reminderEndMinute: 420, archived: true }),
        ],
      },
      sunday,
      sunday,
    );
    expect(events).toEqual([]);
  });
});

describe('done state on the calendar', () => {
  const schedule = {
    id: 's1',
    clientId: null,
    kind: 'WORK' as const,
    daysOfWeek: [1],
    startMinute: 540,
    endMinute: 630,
    label: 'Estudio B1',
    enabled: true,
    pomodoroMin: 40,
    shortBreakMin: 10,
    longBreakMin: 10,
    pomodorosPerChunk: 2,
    chunks: 1,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  it('marks a work block done only on the day it was completed', () => {
    const completions = [
      { id: 'c1', scheduleId: 's1', date: '2026-09-28T00:00:00.000Z', clientId: null, updatedAt: '' },
    ];
    const nextMonday = new Date(2026, 9, 5);
    const [today] = buildEventsForRange(
      { ...EMPTY, schedules: [schedule] as never, scheduleCompletions: completions },
      monday,
      monday,
    );
    const [later] = buildEventsForRange(
      { ...EMPTY, schedules: [schedule] as never, scheduleCompletions: completions },
      nextMonday,
      nextMonday,
    );
    expect(today.meta?.done).toBe(true);
    expect(today.meta?.scheduleId).toBe('s1');
    expect(later.meta?.done).toBe(false);
  });

  it('marks a habit block done from that day\'s DONE record', () => {
    const records = [
      { id: 'r1', habitId: 'h1', date: '2026-09-28T00:00:00.000Z', value: 1, status: 'DONE' },
    ] as never;
    const [event] = buildEventsForRange(
      { ...EMPTY, habits: [habit({ reminderEndMinute: 420 })], habitRecords: records },
      monday,
      monday,
    );
    expect(event.meta?.done).toBe(true);
    expect(event.meta?.habitRecordId).toBe('r1');
  });
});

describe('dateKey', () => {
  it('uses the local day, even late in the evening', () => {
    expect(dateKey(new Date(2026, 8, 28, 23, 30))).toBe('2026-09-28');
  });

  it('reads a stored record date as its own day', () => {
    expect(dateKey('2026-09-28T00:00:00.000Z')).toBe('2026-09-28');
  });
});
