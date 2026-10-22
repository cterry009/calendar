import { describe, expect, it } from 'vitest';
import { morningWindowPayloads } from './morningWindow';
import { phaseKey } from '../focusView/store';
import type { SyncScheduleRecord } from '../schedules/types';

const schedule = (patch: Partial<SyncScheduleRecord>): SyncScheduleRecord => ({
  id: 'b1',
  kind: 'WORK',
  daysOfWeek: [1, 2, 4],
  startMinute: 570,
  endMinute: 750,
  label: 'Estudio B1',
  enabled: true,
  pomodoroMin: null,
  shortBreakMin: null,
  longBreakMin: null,
  pomodorosPerChunk: null,
  chunks: null,
  category: 'estudio_b1',
  sequence: [{ tipo: 'foco', minutos: 30, etiqueta: 'P1' }],
  ...patch,
});

describe('Actualizar la mañana', () => {
  it('sends the whole schedule with the window, no sequence and two flexible blocks', () => {
    const payloads = morningWindowPayloads(
      [
        schedule({}),
        schedule({
          id: 'pm',
          startMinute: 840,
          endMinute: 925,
          category: 'codigo_academico',
          label: 'Código',
        }),
      ],
      new Date('2026-10-22T15:00:00.000Z'),
    );
    expect(payloads).toEqual([
      expect.objectContaining({
        id: 'b1',
        kind: 'WORK',
        daysOfWeek: [1, 2, 4],
        label: 'Estudio B1',
        enabled: true,
        category: 'estudio_b1',
        startMinute: 480,
        endMinute: 720,
        sequence: null,
        flexibleBlocks: 2,
      }),
    ]);
  });

  it('has nothing to do once the morning is a window', () => {
    expect(
      morningWindowPayloads([
        schedule({ startMinute: 480, endMinute: 720, sequence: null, flexibleBlocks: 2 }),
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
