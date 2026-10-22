import { describe, expect, it } from 'vitest';
import { weekdayPayloads } from './morningWindow';
import { phaseKey } from '../focusView/store';
import type { SyncScheduleRecord } from '../schedules/types';

const schedule = (patch: Partial<SyncScheduleRecord>): SyncScheduleRecord => ({
  id: 'b1',
  kind: 'WORK',
  daysOfWeek: [1, 2, 4],
  startMinute: 480,
  endMinute: 720,
  label: 'Estudio B1',
  enabled: true,
  pomodoroMin: null,
  shortBreakMin: null,
  longBreakMin: null,
  pomodorosPerChunk: null,
  chunks: null,
  category: 'estudio_b1',
  sequence: null,
  flexibleBlocks: 2,
  ...patch,
});

describe('Actualizar la jornada (revision 2)', () => {
  it('sends whole schedules: the morning in place, its second suggestion, the afternoon, lunch, and the break deleted', () => {
    const payloads = weekdayPayloads([
      schedule({}),
      schedule({
        id: 'pm',
        startMinute: 840,
        endMinute: 925,
        category: 'codigo_academico',
        label: 'Código',
        flexibleBlocks: null,
        sequence: [{ tipo: 'foco', minutos: 25, etiqueta: 'P' }],
      }),
      schedule({
        id: 'lu',
        kind: 'REST',
        startMinute: 750,
        endMinute: 840,
        label: 'Almuerzo',
        category: null,
        flexibleBlocks: null,
        daysOfWeek: [1, 2, 3, 4, 5],
      }),
      schedule({
        id: 'de',
        kind: 'REST',
        startMinute: 925,
        endMinute: 935,
        label: 'Descanso',
        category: null,
        flexibleBlocks: null,
        daysOfWeek: [1, 2, 3, 4, 5],
      }),
    ]);
    expect(payloads).toEqual([
      expect.objectContaining({
        id: 'b1',
        kind: 'WORK',
        label: 'Estudio B1',
        category: 'estudio_b1',
        startMinute: 540,
        endMinute: 630,
        sequence: null,
        flexibleBlocks: 1,
      }),
      expect.objectContaining({
        id: 'pm',
        startMinute: 840,
        endMinute: 930,
        sequence: null,
        flexibleBlocks: 1,
      }),
      expect.objectContaining({ id: 'lu', kind: 'REST', startMinute: 780, endMinute: 840 }),
      expect.objectContaining({
        kind: 'WORK',
        label: 'Estudio B1',
        daysOfWeek: [1, 2, 4],
        startMinute: 660,
        endMinute: 750,
        flexibleBlocks: 1,
      }),
      expect.objectContaining({ id: 'de', deleted: true }),
    ]);
    expect(payloads[3]).not.toHaveProperty('id');
  });

  it('has nothing to do once the weekday is flexible', () => {
    expect(
      weekdayPayloads([
        schedule({ startMinute: 540, endMinute: 630, flexibleBlocks: 1 }),
        schedule({ id: 'b1b', startMinute: 660, endMinute: 750, flexibleBlocks: 1 }),
      ]),
    ).toEqual([]);
  });
});

describe('focus view phases', () => {
  it('changes with the segment and the start, so a collapsed view comes back next phase', () => {
    const base = {
      id: 's',
      state: 'FOCUS',
      segmentIndex: 0,
      startedAt: '2026-10-26T13:00:00.000Z',
    };
    expect(phaseKey(base)).not.toBe(phaseKey({ ...base, state: 'SHORT_BREAK', segmentIndex: 1 }));
    expect(phaseKey(base)).not.toBe(phaseKey({ ...base, startedAt: '2026-10-26T13:30:00.000Z' }));
  });
});
