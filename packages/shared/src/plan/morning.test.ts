import { HORARIO_2026 } from './horario.js';
import {
  blockDone,
  checkInProposal,
  clampBlockMin,
  clampFocusMin,
  dueMorningReminder,
  energyOf,
  morningStatus,
  plannedFocusMinutes,
  planFlexibleBlock,
  type FlexibleSessionLike,
} from './morning.js';
import { morningWindowChanges, needsMorningWindowUpdate, templateToSchedules } from './plan.js';
import { sequenceMinutes } from './sequence.js';

// Monday 26 Oct 2026, local time.
const at = (h: number, m = 0) => new Date(2026, 9, 26, h, m);
const shape = (blockMin: number, focusMin: number) =>
  planFlexibleBlock(blockMin, focusMin).map((s) => s.minutos);

describe('energy table', () => {
  it('averages motivation and concentration, rounding halves up', () => {
    expect(energyOf(2, 2)).toBe(2);
    expect(energyOf(3, 2)).toBe(3);
    expect(energyOf(5, 4)).toBe(5);
  });

  it('E = 2 proposes 90/20 and E = 5 proposes 150/40', () => {
    expect(checkInProposal(2, 2)).toEqual({ energy: 2, blockMin: 90, focusMin: 20 });
    expect(checkInProposal(1, 3)).toMatchObject({ blockMin: 90, focusMin: 20 });
    expect(checkInProposal(3, 3)).toMatchObject({ blockMin: 120, focusMin: 30 });
    expect(checkInProposal(5, 5)).toEqual({ energy: 5, blockMin: 150, focusMin: 40 });
  });

  it('keeps manual adjustments inside 90-150 and 20-40', () => {
    expect(clampBlockMin(200)).toBe(150);
    expect(clampBlockMin(100)).toBe(105);
    expect(clampFocusMin(12)).toBe(20);
    expect(clampFocusMin(33)).toBe(35);
  });
});

describe('flexible block plan', () => {
  it('fits each row of the table with its pauses and the closing', () => {
    expect(shape(90, 20)).toEqual([20, 5, 20, 5, 20, 5, 15]);
    expect(shape(120, 30)).toEqual([30, 5, 30, 5, 30, 5, 15]);
    expect(shape(150, 40)).toEqual([40, 10, 40, 10, 30, 5, 15]);
    for (const [block, focus] of [
      [90, 20],
      [120, 30],
      [150, 40],
    ]) {
      expect(sequenceMinutes(planFlexibleBlock(block, focus))).toBe(block);
    }
    expect(plannedFocusMinutes(planFlexibleBlock(90, 20))).toBe(60);
  });

  it('drops a last focus under 20 and ends early instead', () => {
    expect(shape(135, 30)).toEqual([30, 5, 30, 5, 30, 5, 15]);
  });

  it('respects a manual adjustment', () => {
    expect(shape(105, 25)).toEqual([25, 5, 25, 5, 25, 5, 15]);
  });

  it('ends with the closing and labels the focuses', () => {
    const plan = planFlexibleBlock(120, 30);
    expect(plan.at(-1)).toMatchObject({ tipo: 'cierre', minutos: 15 });
    expect(plan[0].etiqueta).toMatch(/^P1 · arranque/);
    expect(plan[4].etiqueta).toMatch(/^P3 · corto/);
  });
});

describe('block and morning completion', () => {
  const session = (
    n: number,
    focusMinutes: number,
    extra: Partial<FlexibleSessionLike> = {},
  ): FlexibleSessionLike => ({
    id: `block-s-2026-10-26-${n}`,
    flexible: true,
    blockStartAt: at(8 + n).toISOString(),
    focusMinutes,
    ...extra,
  });

  it('a block with 60 minutes of focus is done and one with 30 is not', () => {
    expect(blockDone({ focusMinutes: 60 })).toBe(true);
    expect(blockDone({ focusMinutes: 30 })).toBe(false);
  });

  it('the morning is fulfilled with two done blocks', () => {
    expect(morningStatus([session(1, 72), session(2, 30)], '2026-10-26')).toMatchObject({
      started: 2,
      done: 1,
      fulfilled: false,
    });
    expect(morningStatus([session(1, 72), session(2, 60)], '2026-10-26')).toMatchObject({
      done: 2,
      fulfilled: true,
    });
    // Fixed blocks and other days don't count.
    expect(
      morningStatus([{ ...session(1, 90), flexible: false }, session(2, 90)], '2026-10-27').started,
    ).toBe(0);
  });
});

describe('reminders', () => {
  it('reminds at 08:20 and 08:50 when no block has started', () => {
    expect(dueMorningReminder({ now: at(8, 10), sessions: [], sent: [] })).toBeNull();
    expect(dueMorningReminder({ now: at(8, 20), sessions: [], sent: [] })?.id).toBe('start-1');
    expect(dueMorningReminder({ now: at(8, 30), sessions: [], sent: ['start-1'] })).toBeNull();
    expect(dueMorningReminder({ now: at(8, 50), sessions: [], sent: ['start-1'] })?.id).toBe(
      'start-2',
    );
    // Opened at 09:00: only the latest one, and no earlier one after it.
    expect(dueMorningReminder({ now: at(9), sessions: [], sent: [] })?.id).toBe('start-2');
    expect(dueMorningReminder({ now: at(9, 5), sessions: [], sent: ['start-2'] })).toBeNull();
  });

  it('reminds 20 minutes after the first block ended', () => {
    const first: FlexibleSessionLike = {
      id: 'b-1',
      flexible: true,
      blockStartAt: at(8, 30).toISOString(),
      endedAt: at(10).toISOString(),
      focusMinutes: 70,
    };
    expect(dueMorningReminder({ now: at(10, 10), sessions: [first], sent: [] })).toBeNull();
    expect(dueMorningReminder({ now: at(10, 20), sessions: [first], sent: [] })?.id).toBe(
      'between-1',
    );
    expect(
      dueMorningReminder({
        now: at(10, 20),
        sessions: [{ ...first, endedAt: null, active: true }],
        sent: [],
      }),
    ).toBeNull();
  });

  it('never after 12:00, once fulfilled, or past the cap', () => {
    expect(dueMorningReminder({ now: at(12), sessions: [], sent: [] })).toBeNull();
    expect(
      dueMorningReminder({ now: at(9), sessions: [], sent: ['start-1', 'x', 'y'] }),
    ).toBeNull();
    const done = (n: number): FlexibleSessionLike => ({
      id: `b-${n}`,
      flexible: true,
      blockStartAt: at(8 + n).toISOString(),
      endedAt: at(9 + n).toISOString(),
      focusMinutes: 60,
    });
    expect(
      dueMorningReminder({ now: at(11, 30), sessions: [done(1), done(2)], sent: [] }),
    ).toBeNull();
  });
});

describe('the morning window in the timetable', () => {
  it('is dated and uses two blocks', () => {
    expect(HORARIO_2026.bloques_manana).toMatchObject({
      ventana: { inicio: '08:00', fin: '12:00' },
      bloques: 2,
    });
  });

  it('updates the old morning blocks in place and leaves the rest alone', () => {
    const old = [
      {
        id: 'b1',
        kind: 'WORK' as const,
        daysOfWeek: [1, 2, 4],
        startMinute: 570,
        endMinute: 750,
        category: 'estudio_b1',
      },
      {
        id: 'pe',
        kind: 'WORK' as const,
        daysOfWeek: [5],
        startMinute: 570,
        endMinute: 750,
        category: 'pilar_e',
      },
      {
        id: 'pm',
        kind: 'WORK' as const,
        daysOfWeek: [1, 5],
        startMinute: 840,
        endMinute: 925,
        category: 'codigo_academico',
      },
      {
        id: 'sa',
        kind: 'WORK' as const,
        daysOfWeek: [6],
        startMinute: 540,
        endMinute: 630,
        category: 'repaso',
      },
      {
        id: 'lu',
        kind: 'REST' as const,
        daysOfWeek: [1],
        startMinute: 750,
        endMinute: 840,
        category: null,
      },
    ];
    const changes = morningWindowChanges(old, '2026-10-22T12:00:00.000Z');
    expect(changes).toEqual([
      {
        id: 'b1',
        updatedAt: '2026-10-22T12:00:00.000Z',
        startMinute: 480,
        endMinute: 720,
        sequence: null,
        flexibleBlocks: 2,
      },
      {
        id: 'pe',
        updatedAt: '2026-10-22T12:00:00.000Z',
        startMinute: 480,
        endMinute: 720,
        sequence: null,
        flexibleBlocks: 2,
      },
    ]);
    const updated = old.map((s) => ({
      ...s,
      ...(changes.find((c) => c.id === s.id) ?? {}),
    })) as typeof old;
    expect(needsMorningWindowUpdate(updated)).toBe(false);
  });

  it('a fresh template needs no update', () => {
    const fresh = templateToSchedules().map((s, i) => ({ ...s, id: `s${i}` }));
    expect(needsMorningWindowUpdate(fresh)).toBe(false);
  });
});
