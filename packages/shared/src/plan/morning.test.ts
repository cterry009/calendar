import { HORARIO_2026 } from './horario.js';
import {
  adjustPlannedBlock,
  afternoonStatus,
  bandOf,
  blockDone,
  clampBlockMin,
  clampFocusMin,
  diagnosisProposal,
  dueBlockReminder,
  maxFittingFocus,
  morningStatus,
  ratingTo100,
  windowForMinute,
  type FlexibleSessionLike,
} from './morning.js';
import {
  needsWeekdayUpdate,
  templateToSchedules,
  weekdayV2Changes,
  type WeekdayScheduleLike,
} from './plan.js';

// Monday 26 Oct 2026, local time.
const at = (h: number, m = 0) => new Date(2026, 9, 26, h, m);

describe('diagnosis 0-100 (revision 2)', () => {
  it('bands: low under 45, medium 45-69, high from 70', () => {
    expect(bandOf(44)).toBe('baja');
    expect(bandOf(45)).toBe('media');
    expect(bandOf(69)).toBe('media');
    expect(bandOf(70)).toBe('alta');
  });

  it('a low first diagnosis gives a 60-minute block of 20-minute focuses, a top one 120/40', () => {
    expect(diagnosisProposal(40, 40)).toMatchObject({ band: 'baja', blockMin: 60, focusMin: 20 });
    expect(diagnosisProposal(100, 100)).toMatchObject({
      band: 'alta',
      blockMin: 120,
      focusMin: 40,
    });
    expect(diagnosisProposal(60, 50)).toMatchObject({ band: 'media', blockMin: 90, focusMin: 30 });
    // The chat's first diagnosis (90/80) and its second (35/25).
    expect(diagnosisProposal(90, 80)).toMatchObject({ blockMin: 120, focusMin: 40 });
    expect(diagnosisProposal(35, 25)).toMatchObject({ band: 'baja', focusMin: 20 });
  });

  it('keeps manual adjustments inside 60-120 (steps of 10) and 20-40 (steps of 5)', () => {
    expect(clampBlockMin(130)).toBe(120);
    expect(clampBlockMin(84)).toBe(80);
    expect(clampBlockMin(40)).toBe(60);
    expect(clampFocusMin(12)).toBe(20);
    expect(clampFocusMin(27)).toBe(25);
  });

  it('reads old 1-5 ratings on the 0-100 scale', () => {
    expect(ratingTo100(1)).toBe(0);
    expect(ratingTo100(4)).toBe(75);
    expect(ratingTo100(55, '0-100')).toBe(55);
  });
});

describe('the ±10 rule', () => {
  const base = {
    planned: 90,
    lastRating: 60,
    band: 'media' as const,
    lastCut: false,
    workedMin: 30,
  };

  it('+10 when the rating and the diagnosis are both high', () => {
    expect(adjustPlannedBlock({ ...base, lastRating: 80, band: 'alta' })).toMatchObject({
      planned: 100,
      delta: 10,
    });
  });

  it('−10 when either is low or the focus was cut', () => {
    expect(adjustPlannedBlock({ ...base, lastRating: 30 }).planned).toBe(80);
    expect(adjustPlannedBlock({ ...base, band: 'baja' }).planned).toBe(80);
    expect(
      adjustPlannedBlock({ ...base, lastCut: true, lastRating: 90, band: 'alta' }).planned,
    ).toBe(80);
  });

  it('the same otherwise, and a dismissed rating is no signal', () => {
    expect(adjustPlannedBlock(base).planned).toBe(90);
    expect(adjustPlannedBlock({ ...base, lastRating: null, band: 'alta' }).planned).toBe(90);
  });

  it('stays within 60-120 and never under what was worked', () => {
    expect(
      adjustPlannedBlock({ ...base, planned: 120, lastRating: 90, band: 'alta' }),
    ).toMatchObject({ planned: 120, delta: 0 });
    expect(adjustPlannedBlock({ ...base, planned: 60, band: 'baja' }).planned).toBe(60);
    expect(adjustPlannedBlock({ ...base, planned: 80, band: 'baja', workedMin: 76 }).planned).toBe(
      80,
    );
    expect(adjustPlannedBlock({ ...base, planned: 60, lastCut: true, workedMin: 50 }).planned).toBe(
      60,
    );
  });

  it("the chat's block: 120 planned, rated 55, then 35/25 → 110 and a 20-minute focus", () => {
    const next = diagnosisProposal(35, 25);
    expect(
      adjustPlannedBlock({
        planned: 120,
        lastRating: 55,
        band: next.band,
        lastCut: false,
        workedMin: 50,
      }).planned,
    ).toBe(110);
    expect(next.focusMin).toBe(20);
  });
});

describe('what still fits the planned block', () => {
  it('the longest focus that fits with its pause and the closing, or none', () => {
    expect(maxFittingFocus(90, 0)).toBe(40);
    expect(maxFittingFocus(60, 20)).toBe(20); // 40 left: 20 + 5 + 15
    expect(maxFittingFocus(60, 21)).toBeNull();
    expect(maxFittingFocus(60, 45)).toBeNull();
  });
});

describe('completion', () => {
  const session = (
    n: number,
    focusMinutes: number,
    h: number,
    windowEnd: number,
  ): FlexibleSessionLike => ({
    id: `block-s${n}-2026-10-26-1`,
    scheduleId: `s${n}`,
    flexible: true,
    blockStartAt: at(h).toISOString(),
    windowEndAt: at(windowEnd).toISOString(),
    focusMinutes,
  });

  it('a block with 45 minutes of focus is done and one with 30 is not', () => {
    expect(blockDone({ focusMinutes: 45 })).toBe(true);
    expect(blockDone({ focusMinutes: 30 })).toBe(false);
  });

  it("the day's minimum is two done morning blocks; the afternoon is counted apart", () => {
    const day = [session(1, 72, 9, 13), session(2, 30, 11, 13), session(3, 80, 14, 18)];
    expect(morningStatus(day, '2026-10-26')).toMatchObject({
      started: 2,
      done: 1,
      fulfilled: false,
    });
    expect(afternoonStatus(day, '2026-10-26')).toMatchObject({ started: 1, done: 1 });
    expect(
      morningStatus([session(1, 50, 9, 13), session(2, 45, 11, 13)], '2026-10-26').fulfilled,
    ).toBe(true);
  });

  it('the windows are 09:00-13:00 and 14:00-18:00', () => {
    expect(windowForMinute(9 * 60)?.name).toBe('manana');
    expect(windowForMinute(13 * 60)).toBeNull();
    expect(windowForMinute(17 * 60 + 59)?.name).toBe('tarde');
  });
});

describe('reminders at the suggested times', () => {
  const suggestions = [
    { scheduleId: 'm1', startMinute: 9 * 60, label: 'Estudio B1' },
    { scheduleId: 'm2', startMinute: 11 * 60, label: 'Estudio B1' },
    { scheduleId: 'a1', startMinute: 14 * 60, label: 'Código de las notas' },
    { scheduleId: 'a2', startMinute: 16 * 60, label: 'Maestrías' },
  ];
  const ran = (scheduleId: string, active: boolean): FlexibleSessionLike => ({
    id: `x-${scheduleId}`,
    scheduleId,
    flexible: true,
    active,
    blockStartAt: at(9, 10).toISOString(),
    endedAt: active ? null : at(10, 40).toISOString(),
  });

  it('at 11:00 only when no block is running', () => {
    expect(
      dueBlockReminder({ now: at(11), suggestions, sessions: [ran('m1', true)], sent: [] }),
    ).toBeNull();
    expect(
      dueBlockReminder({ now: at(11), suggestions, sessions: [ran('m1', false)], sent: [] })?.id,
    ).toBe('m2');
  });

  it('once per suggestion, and not for one already started', () => {
    expect(
      dueBlockReminder({
        now: at(11, 20),
        suggestions,
        sessions: [ran('m1', false)],
        sent: ['m2'],
      }),
    ).toBeNull();
    expect(
      dueBlockReminder({ now: at(9, 30), suggestions, sessions: [ran('m1', false)], sent: [] }),
    ).toBeNull();
    expect(dueBlockReminder({ now: at(9, 5), suggestions, sessions: [], sent: [] })?.id).toBe('m1');
  });

  it('not after the window closes, nor before the time', () => {
    expect(dueBlockReminder({ now: at(13, 10), suggestions, sessions: [], sent: [] })).toBeNull();
    expect(dueBlockReminder({ now: at(8, 50), suggestions, sessions: [], sent: [] })).toBeNull();
    expect(dueBlockReminder({ now: at(16, 5), suggestions, sessions: [], sent: ['a1'] })?.id).toBe(
      'a2',
    );
  });
});

describe('the weekday in the timetable (revision 2)', () => {
  it('is two windows with suggested blocks, lunch at 13:00, and Saturday unchanged', () => {
    expect(
      HORARIO_2026.bloques_dinamicos.ventanas_lun_vie.map((w) => `${w.inicio}-${w.fin}`),
    ).toEqual(['09:00-13:00', '14:00-18:00']);
    const schedules = templateToSchedules();
    const b1 = schedules.filter((s) => s.label === 'Estudio B1');
    expect(b1.map((s) => [s.startMinute, s.endMinute, s.flexibleBlocks, s.sequence])).toEqual([
      [540, 630, 1, null],
      [660, 750, 1, null],
    ]);
    expect(schedules.find((s) => s.label === 'Proyecto de datos')).toMatchObject({
      startMinute: 840,
      endMinute: 930,
      flexibleBlocks: 1,
      sequence: null,
    });
    expect(schedules.find((s) => s.label === 'Almuerzo')).toMatchObject({
      startMinute: 780,
      endMinute: 840,
    });
    expect(schedules.some((s) => s.label === 'Descanso' && s.daysOfWeek.includes(1))).toBe(false);
    expect(schedules.find((s) => s.daysOfWeek.includes(6) && s.kind === 'WORK')).toMatchObject({
      flexibleBlocks: null,
    });
  });

  it('updates an existing timetable in place: ids kept, second suggestion created, lunch moved, break deleted', () => {
    const old: WeekdayScheduleLike[] = [
      {
        id: 'b1',
        kind: 'WORK',
        daysOfWeek: [1, 2, 4],
        startMinute: 480,
        endMinute: 720,
        label: 'Estudio B1',
        category: 'estudio_b1',
        flexibleBlocks: 2,
      },
      {
        id: 'pm',
        kind: 'WORK',
        daysOfWeek: [1, 5],
        startMinute: 840,
        endMinute: 925,
        label: 'Código de las notas',
        category: 'codigo_academico',
        sequence: [{ tipo: 'foco', minutos: 25, etiqueta: 'P' }],
      },
      {
        id: 'ca',
        kind: 'WORK',
        daysOfWeek: [1],
        startMinute: 935,
        endMinute: 1020,
        label: 'Maestrías',
        category: 'carrera',
      },
      {
        id: 'lu',
        kind: 'REST',
        daysOfWeek: [1, 2, 3, 4, 5],
        startMinute: 750,
        endMinute: 840,
        label: 'Almuerzo',
      },
      {
        id: 'de',
        kind: 'REST',
        daysOfWeek: [1, 2, 3, 4, 5],
        startMinute: 925,
        endMinute: 935,
        label: 'Descanso',
      },
      {
        id: 'sa',
        kind: 'WORK',
        daysOfWeek: [6],
        startMinute: 540,
        endMinute: 630,
        label: 'Repaso',
        category: 'repaso',
      },
    ];
    const changes = weekdayV2Changes(old);
    expect(
      changes.updates.map((s) => [s.id, s.startMinute, s.endMinute, s.flexibleBlocks ?? null]),
    ).toEqual([
      ['b1', 540, 630, 1],
      ['pm', 840, 930, 1],
      ['ca', 960, 1050, 1],
      ['lu', 780, 840, null],
    ]);
    expect(changes.updates.find((s) => s.id === 'pm')?.sequence).toBeNull();
    expect(changes.creates).toEqual([
      expect.objectContaining({
        label: 'Estudio B1',
        category: 'estudio_b1',
        daysOfWeek: [1, 2, 4],
        startMinute: 660,
        endMinute: 750,
        flexibleBlocks: 1,
      }),
    ]);
    expect(changes.deletes).toEqual(['de']);

    const applied = [
      ...old
        .filter((s) => !changes.deletes.includes(s.id))
        .map((s) => changes.updates.find((u) => u.id === s.id) ?? s),
      ...changes.creates.map((c, i) => ({ ...c, id: `new${i}` })),
    ];
    expect(needsWeekdayUpdate(applied)).toBe(false);
  });

  it('a fresh template needs no update', () => {
    const fresh = templateToSchedules().map((s, i) => ({ ...s, id: `s${i}` }));
    expect(needsWeekdayUpdate(fresh)).toBe(false);
  });
});
