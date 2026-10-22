import { jest } from '@jest/globals';
import {
  canCutSegment,
  createFlexibleBlockSession,
  createSequenceBlockSession,
  currentSegment,
  elapsedBlockMinutes,
  getPhaseDurationMinutes,
  isBlockingPhase,
  isPhaseAbandoned,
  lastFocusWasCut,
  nextFlexibleWork,
  pauseOverrunMinutes,
  transitionPomodoro,
} from './state-machine.js';
import {
  activeWorkSchedule,
  currentFocusStatus,
  flexibleBlockSessionId,
  flexibleWindowNow,
  nextFlexibleBlockNumber,
} from '../attention/focus-status.js';
import { HORARIO_2026 } from '../plan/horario.js';
import type { PomodoroSession } from '../schemas/pomodoro.js';

// Monday 26 Oct 2026, local time.
const at = (h: number, m = 0) => new Date(2026, 9, 26, h, m);
const morningEnd = at(13).toISOString();
const block = (blockMin: number, focusMin: number, windowEndAt: string | null = morningEnd) =>
  createFlexibleBlockSession('block-s-2026-10-26-1', { blockMin, focusMin, windowEndAt });
const endOf = (s: PomodoroSession) =>
  new Date(new Date(s.startedAt!).getTime() + getPhaseDurationMinutes(s)! * 60_000);
const clock = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
const finishFocus = (s: PomodoroSession) => {
  jest.setSystemTime(endOf(s));
  return transitionPomodoro(s, { type: 'FOCUS_COMPLETE' });
};

afterEach(() => jest.useRealTimers());

describe('a flexible block (revision 2)', () => {
  it('started at 10:10 loses nothing: its first focus starts at 10:10 and the plan runs from then', () => {
    jest.useFakeTimers({ now: at(10, 10) });
    const session = transitionPomodoro(block(90, 30), { type: 'START', taskId: 't1' });
    expect(session).toMatchObject({
      active: true,
      state: 'FOCUS',
      segmentIndex: 0,
      focusDurationMin: 30,
      plannedBlockMin: 90,
      taskId: 't1',
    });
    expect(clock(endOf(session))).toBe('10:40');
    expect(session.blockEndAt).toBeNull();
    expect(isBlockingPhase(session)).toBe(true);
  });

  it('starts the pause by itself and never the focus', () => {
    jest.useFakeTimers({ now: at(9) });
    let session = finishFocus(transitionPomodoro(block(90, 30), { type: 'START' }));
    expect(session).toMatchObject({
      state: 'SHORT_BREAK',
      shortBreakMin: 5,
      completedCycles: 1,
      focusMinutes: 30,
    });
    expect(isBlockingPhase(session)).toBe(false);
    jest.setSystemTime(at(9, 50));
    expect(transitionPomodoro(session, { type: 'BREAK_COMPLETE' })).toBe(session);
    expect(pauseOverrunMinutes(session, Date.now())).toBe(15);
    // Until the user starts the next focus, with the rule's planned block and its diagnosis's length.
    session = transitionPomodoro(session, {
      type: 'START_FOCUS',
      minutes: 20,
      plannedBlockMin: 100,
    });
    expect(session).toMatchObject({ state: 'FOCUS', focusDurationMin: 20, plannedBlockMin: 100 });
    expect(session.sequence!.map((s) => s.minutos)).toEqual([30, 5, 20, 5]);
    expect(session.sequence![2].etiqueta).toMatch(/^P2 · profundo/);
    expect(clock(endOf(session))).toBe('10:10');
  });

  it('respects the length the user picks, past what fits', () => {
    jest.useFakeTimers({ now: at(9) });
    let session = finishFocus(transitionPomodoro(block(60, 20), { type: 'START' }));
    session = transitionPomodoro(session, { type: 'START_FOCUS', minutes: 40 });
    expect(session.focusDurationMin).toBe(40);
    session = finishFocus(session);
    expect(session).toMatchObject({ shortBreakMin: 10, focusMinutes: 60 });
  });

  it('offers the closing once another focus no longer fits the planned block', () => {
    jest.useFakeTimers({ now: at(9) });
    let session = finishFocus(transitionPomodoro(block(60, 20), { type: 'START' }));
    // 20 minutes in: a 20 still fits (20 + 5 + 15 = 40 of the 40 left).
    expect(nextFlexibleWork(session)).toMatchObject({ tipo: 'foco', minutes: 20 });
    session = finishFocus(transitionPomodoro(session, { type: 'START_FOCUS' }));
    // 45 minutes in: only the closing.
    expect(nextFlexibleWork(session)).toMatchObject({ tipo: 'cierre', closingOnly: false });
    session = transitionPomodoro(session, { type: 'START_FOCUS', minutes: 30 });
    expect(currentSegment(session)).toMatchObject({ tipo: 'cierre', minutos: 15 });
    jest.setSystemTime(endOf(session));
    session = transitionPomodoro(session, { type: 'FOCUS_COMPLETE' });
    expect(session).toMatchObject({
      active: false,
      interrupted: false,
      completedCycles: 2,
      focusMinutes: 40,
    });
  });

  it('never plans under what was already worked', () => {
    jest.useFakeTimers({ now: at(9) });
    let session = finishFocus(transitionPomodoro(block(90, 40), { type: 'START' }));
    jest.setSystemTime(at(10, 15)); // 75 minutes in
    session = transitionPomodoro(session, {
      type: 'START_FOCUS',
      minutes: 20,
      plannedBlockMin: 60,
      closing: false,
    });
    expect(session.plannedBlockMin).toBe(80);
    expect(elapsedBlockMinutes(session)).toBe(75);
  });

  it('cutting a focus counts its minutes, starts the pause and marks it as low energy', () => {
    jest.useFakeTimers({ now: at(9) });
    let session = transitionPomodoro(block(120, 40), { type: 'START' });
    expect(canCutSegment(session)).toBe(true);
    jest.setSystemTime(at(9, 27));
    session = transitionPomodoro(session, { type: 'CUT_SEGMENT' });
    expect(session).toMatchObject({
      state: 'SHORT_BREAK',
      cutCount: 1,
      completedCycles: 1,
      focusMinutes: 27,
      shortBreakMin: 10,
    });
    expect(lastFocusWasCut(session)).toBe(true);
    session = finishFocus(transitionPomodoro(session, { type: 'START_FOCUS', minutes: 30 }));
    expect(lastFocusWasCut(session)).toBe(false);
  });

  it('after the window closes the running focus finishes and the closing follows', () => {
    jest.useFakeTimers({ now: at(12, 45) });
    let session = finishFocus(transitionPomodoro(block(90, 30), { type: 'START' })); // 13:15
    expect(nextFlexibleWork(session)).toMatchObject({ tipo: 'cierre', closingOnly: true });
    session = transitionPomodoro(session, { type: 'START_FOCUS', minutes: 30 });
    expect(currentSegment(session)?.tipo).toBe('cierre');
  });

  it('"Terminar bloque" counts the running focus and ends cleanly', () => {
    jest.useFakeTimers({ now: at(9) });
    let session = transitionPomodoro(block(90, 30), { type: 'START' });
    jest.setSystemTime(at(9, 18));
    session = transitionPomodoro(session, { type: 'END_BLOCK' });
    expect(session).toMatchObject({ active: false, interrupted: false, focusMinutes: 18 });
  });

  it('"Salir" pauses and resuming keeps the focus time left', () => {
    jest.useFakeTimers({ now: at(9) });
    let session = transitionPomodoro(block(90, 30), { type: 'START' });
    jest.setSystemTime(at(9, 10));
    session = transitionPomodoro(session, { type: 'PAUSE' });
    jest.setSystemTime(at(9, 40));
    session = transitionPomodoro(session, { type: 'RESUME' });
    // 30 minutes out: the 30-minute focus started at 09:00 now ends at 10:00 instead of 09:30.
    expect(clock(endOf(session))).toBe('10:00');
  });

  it('a pause left open is abandoned only an hour past its end', () => {
    jest.useFakeTimers({ now: at(9) });
    const session = finishFocus(transitionPomodoro(block(90, 30), { type: 'START' }));
    expect(isPhaseAbandoned(session, at(10, 0).getTime())).toBe(false);
    expect(isPhaseAbandoned(session, at(10, 40).getTime())).toBe(true);
  });
});

describe('Saturday keeps its clock-anchored sequence', () => {
  it('starting late still joins the segment running now', () => {
    jest.useFakeTimers({ now: at(9, 40) });
    const session = transitionPomodoro(
      createSequenceBlockSession(
        'b',
        'LIGHT',
        at(9).toISOString(),
        at(10, 30).toISOString(),
        HORARIO_2026.secuencias_pomodoro.sabado,
      ),
      { type: 'START' },
    );
    // 09:00 25' focus, 09:25 pause, 09:30 25' focus: at 09:40 it's the second focus, ending 09:55.
    expect(session.segmentIndex).toBe(2);
    expect(clock(endOf(session))).toBe('9:55');
  });
});

describe('the suggestions in the clients', () => {
  const schedules = [
    {
      id: 'm',
      kind: 'WORK',
      enabled: true,
      daysOfWeek: [1],
      startMinute: 540,
      endMinute: 630,
      label: 'Estudio B1',
      flexibleBlocks: 1,
    },
    {
      id: 's',
      kind: 'WORK',
      enabled: true,
      daysOfWeek: [6],
      startMinute: 540,
      endMinute: 630,
      label: 'Repaso',
    },
  ];

  it("aren't work hours: nothing starts or blocks by itself in them", () => {
    expect(activeWorkSchedule(schedules, at(9))).toBeNull();
    expect(flexibleWindowNow(schedules, at(9))?.id).toBe('m');
    expect(currentFocusStatus({ session: null, schedules, tasks: [], now: at(9) })).toBeNull();
  });

  it("numbers a suggestion's sessions", () => {
    expect(flexibleBlockSessionId('m', at(9), 1)).toBe('block-m-2026-10-26-1');
    expect(
      nextFlexibleBlockNumber(
        [{ id: 'block-m-2026-10-26-1' }, { id: 'block-m-2026-10-25-3' }],
        'm',
        at(11),
      ),
    ).toBe(2);
  });

  it('the status names the block and says when a pause is over', () => {
    jest.useFakeTimers({ now: at(9) });
    let session: PomodoroSession = {
      ...transitionPomodoro(block(90, 30), { type: 'START' }),
      scheduleId: 'm',
    };
    expect(currentFocusStatus({ session, schedules, tasks: [], now: at(9, 5) })).toMatchObject({
      kind: 'pomodoro',
      blockLabel: 'Estudio B1',
    });
    session = finishFocus(session);
    expect(currentFocusStatus({ session, schedules, tasks: [], now: at(9, 50) })?.title).toBe(
      'Pausa terminada',
    );
  });
});
