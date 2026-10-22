import { jest } from '@jest/globals';
import {
  canCutSegment,
  createFlexibleBlockSession,
  createSequenceBlockSession,
  currentSegment,
  getPhaseDurationMinutes,
  isBlockingPhase,
  isPhaseAbandoned,
  nextFlexibleWork,
  nextFocusProposal,
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
const windowEnd = at(12).toISOString();
const block = (blockMin: number, focusMin: number) =>
  createFlexibleBlockSession('block-s-2026-10-26-1', {
    blockMin,
    focusMin,
    windowEndAt: windowEnd,
  });
const endOf = (s: PomodoroSession) =>
  new Date(new Date(s.startedAt!).getTime() + getPhaseDurationMinutes(s)! * 60_000);
const clock = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

afterEach(() => jest.useRealTimers());

describe('a flexible block', () => {
  it('started at 10:10 loses no segment: its first focus starts at 10:10', () => {
    jest.useFakeTimers({ now: at(10, 10) });
    const session = transitionPomodoro(block(120, 30), { type: 'START', taskId: 't1' });
    expect(session).toMatchObject({
      active: true,
      state: 'FOCUS',
      segmentIndex: 0,
      focusDurationMin: 30,
      taskId: 't1',
    });
    expect(clock(endOf(session))).toBe('10:40');
    expect(session.sequence!.filter((s) => s.tipo === 'foco')).toHaveLength(3);
    expect(session.blockEndAt).toBeNull();
    expect(isBlockingPhase(session)).toBe(true);
  });

  it('starts the pause by itself and never the focus', () => {
    jest.useFakeTimers({ now: at(9) });
    let session = transitionPomodoro(block(120, 30), { type: 'START' });
    jest.setSystemTime(endOf(session));
    session = transitionPomodoro(session, { type: 'FOCUS_COMPLETE' });
    expect(session).toMatchObject({
      state: 'SHORT_BREAK',
      shortBreakMin: 5,
      completedCycles: 1,
      focusMinutes: 30,
      segmentIndex: 1,
    });
    expect(isBlockingPhase(session)).toBe(false);
    // The pause's time is up: the session waits in it.
    jest.setSystemTime(at(9, 50));
    expect(transitionPomodoro(session, { type: 'BREAK_COMPLETE' })).toBe(session);
    expect(pauseOverrunMinutes(session, Date.now())).toBe(15);
    expect(nextFocusProposal(session)).toBe(30);
    // Until the user starts the next focus.
    session = transitionPomodoro(session, { type: 'START_FOCUS' });
    expect(session).toMatchObject({ state: 'FOCUS', segmentIndex: 2, focusDurationMin: 30 });
    expect(clock(endOf(session))).toBe('10:20');
  });

  it('respects the length the user picks for a focus', () => {
    jest.useFakeTimers({ now: at(9) });
    let session = transitionPomodoro(block(120, 30), { type: 'START' });
    jest.setSystemTime(endOf(session));
    session = transitionPomodoro(session, { type: 'FOCUS_COMPLETE' });
    session = transitionPomodoro(session, { type: 'START_FOCUS', minutes: 40 });
    expect(session.focusDurationMin).toBe(40);
    expect(getPhaseDurationMinutes(session)).toBe(40);
    // Its pause follows the chosen length.
    jest.setSystemTime(endOf(session));
    session = transitionPomodoro(session, { type: 'FOCUS_COMPLETE' });
    expect(session).toMatchObject({ shortBreakMin: 10, focusMinutes: 70 });
    // Out of range values are clamped.
    expect(transitionPomodoro(session, { type: 'START_FOCUS', minutes: 90 }).focusDurationMin).toBe(
      40,
    );
  });

  it('runs the whole plan to the closing and ends cleanly', () => {
    jest.useFakeTimers({ now: at(8, 30) });
    let session = transitionPomodoro(block(90, 20), { type: 'START' });
    const seen: string[] = [];
    while (session.active) {
      seen.push(`${session.state}:${currentSegment(session)?.tipo}`);
      jest.setSystemTime(endOf(session));
      session =
        session.state === 'FOCUS'
          ? transitionPomodoro(session, { type: 'FOCUS_COMPLETE' })
          : transitionPomodoro(session, { type: 'START_FOCUS' });
    }
    expect(seen).toEqual([
      'FOCUS:foco',
      'SHORT_BREAK:pausa',
      'FOCUS:foco',
      'SHORT_BREAK:pausa',
      'FOCUS:foco',
      'SHORT_BREAK:pausa',
      'FOCUS:cierre',
    ]);
    expect(session).toMatchObject({
      active: false,
      interrupted: false,
      completedCycles: 3,
      focusMinutes: 60,
    });
  });

  it('cutting a focus counts its minutes, starts the pause and shortens the next proposal', () => {
    jest.useFakeTimers({ now: at(9) });
    let session = transitionPomodoro(block(150, 40), { type: 'START' });
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
    expect(nextFocusProposal(session)).toBe(25);
    // The user can still pick another length.
    expect(transitionPomodoro(session, { type: 'START_FOCUS', minutes: 35 }).focusDurationMin).toBe(
      35,
    );
  });

  it('a cut never proposes under 20', () => {
    jest.useFakeTimers({ now: at(9) });
    let session = transitionPomodoro(block(120, 30), { type: 'START' });
    jest.setSystemTime(at(9, 12));
    session = transitionPomodoro(session, { type: 'CUT_SEGMENT' });
    expect(nextFocusProposal(session)).toBe(20);
    expect(session.focusMinutes).toBe(12);
  });

  it('after 12:00 the running focus finishes and the closing follows', () => {
    jest.useFakeTimers({ now: at(11, 45) });
    let session = transitionPomodoro(block(120, 30), { type: 'START' });
    jest.setSystemTime(endOf(session)); // 12:15
    session = transitionPomodoro(session, { type: 'FOCUS_COMPLETE' });
    expect(nextFlexibleWork(session)).toMatchObject({
      tipo: 'cierre',
      closingOnly: true,
      minutes: 15,
    });
    expect(nextFocusProposal(session)).toBeNull();
    session = transitionPomodoro(session, { type: 'START_FOCUS', minutes: 30 });
    expect(currentSegment(session)?.tipo).toBe('cierre');
    expect(session.focusDurationMin).toBe(15);
  });

  it('"Terminar bloque" counts the running focus and ends cleanly', () => {
    jest.useFakeTimers({ now: at(9) });
    let session = transitionPomodoro(block(120, 30), { type: 'START' });
    jest.setSystemTime(at(9, 18));
    session = transitionPomodoro(session, { type: 'END_BLOCK' });
    expect(session).toMatchObject({ active: false, interrupted: false, focusMinutes: 18 });
  });

  it('"Salir" pauses and resuming keeps the focus time left', () => {
    jest.useFakeTimers({ now: at(9) });
    let session = transitionPomodoro(block(120, 30), { type: 'START' });
    jest.setSystemTime(at(9, 10));
    session = transitionPomodoro(session, { type: 'PAUSE' });
    jest.setSystemTime(at(9, 40));
    session = transitionPomodoro(session, { type: 'RESUME' });
    // 30 minutes out: the 30-minute focus started at 09:00 now ends at 10:00 instead of 09:30.
    expect(clock(endOf(session))).toBe('10:00');
  });

  it('a pause left open is abandoned only an hour past its end', () => {
    jest.useFakeTimers({ now: at(9) });
    let session = transitionPomodoro(block(120, 30), { type: 'START' });
    jest.setSystemTime(endOf(session));
    session = transitionPomodoro(session, { type: 'FOCUS_COMPLETE' });
    expect(isPhaseAbandoned(session, at(10, 0).getTime())).toBe(false);
    expect(isPhaseAbandoned(session, at(10, 40).getTime())).toBe(true);
  });
});

describe('afternoon blocks keep their clock-anchored sequence', () => {
  it('starting late still joins the segment running now', () => {
    jest.useFakeTimers({ now: at(14, 40) });
    const session = transitionPomodoro(
      createSequenceBlockSession(
        'b',
        'LIGHT',
        at(14).toISOString(),
        at(15, 25).toISOString(),
        HORARIO_2026.secuencias_pomodoro.tarde,
      ),
      { type: 'START' },
    );
    // 14:00 25' focus, 14:25 pause, 14:30 25' focus: at 14:40 it's the second focus, ending 14:55.
    expect(session.segmentIndex).toBe(2);
    expect(clock(endOf(session))).toBe('14:55');
  });
});

describe('the window in the clients', () => {
  const schedules = [
    {
      id: 'm',
      kind: 'WORK',
      enabled: true,
      daysOfWeek: [1],
      startMinute: 480,
      endMinute: 720,
      label: 'Estudio B1',
      flexibleBlocks: 2,
    },
    {
      id: 'a',
      kind: 'WORK',
      enabled: true,
      daysOfWeek: [1],
      startMinute: 840,
      endMinute: 925,
      label: 'Código de las notas',
    },
  ];

  it("isn't work hours: nothing starts or blocks by itself in it", () => {
    expect(activeWorkSchedule(schedules, at(9))).toBeNull();
    expect(flexibleWindowNow(schedules, at(9))?.id).toBe('m');
    expect(activeWorkSchedule(schedules, at(14, 10))?.id).toBe('a');
    expect(currentFocusStatus({ session: null, schedules, tasks: [], now: at(9) })).toBeNull();
  });

  it("numbers the day's blocks", () => {
    expect(flexibleBlockSessionId('m', at(9), 1)).toBe('block-m-2026-10-26-1');
    expect(nextFlexibleBlockNumber([], 'm', at(9))).toBe(1);
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
    let session: PomodoroSession = { ...transitionPomodoro(block(120, 30), { type: 'START' }), scheduleId: 'm' };
    expect(currentFocusStatus({ session, schedules, tasks: [], now: at(9, 5) })).toMatchObject({
      kind: 'pomodoro',
      blockLabel: 'Estudio B1',
    });
    jest.setSystemTime(endOf(session));
    session = transitionPomodoro(session, { type: 'FOCUS_COMPLETE' });
    expect(currentFocusStatus({ session, schedules, tasks: [], now: at(9, 50) })?.title).toBe(
      'Pausa terminada',
    );
  });
});
