import {
  ABANDONED_PHASE_GRACE_MS,
  createPomodoroSession,
  getPhaseDurationMinutes,
  isBlockingPhase,
  isPhaseAbandoned,
  transitionPomodoro,
  createBlockPomodoroSession,
  sessionClock,
} from './state-machine.js';

describe('pomodoro state machine', () => {
  it('starts in idle and moves to focus', () => {
    let session = createPomodoroSession('p1');
    session = transitionPomodoro(session, { type: 'START', taskId: 'task-1' });

    expect(session.state).toBe('FOCUS');
    expect(session.active).toBe(true);
    expect(session.taskId).toBe('task-1');
    expect(isBlockingPhase(session)).toBe(true);
  });

  it('cycles focus to short break then back to focus', () => {
    let session = createPomodoroSession('p2');
    session = transitionPomodoro(session, { type: 'START' });
    session = transitionPomodoro(session, { type: 'FOCUS_COMPLETE' });

    expect(session.state).toBe('SHORT_BREAK');
    expect(session.completedCycles).toBe(1);
    expect(getPhaseDurationMinutes(session)).toBe(5);

    session = transitionPomodoro(session, { type: 'BREAK_COMPLETE' });
    expect(session.state).toBe('FOCUS');
  });

  it('uses long break after configured cycle count', () => {
    let session = createPomodoroSession('p3', {
      focusDurationMin: 25,
      shortBreakMin: 5,
      longBreakMin: 15,
      cyclesBeforeLongBreak: 2,
    });

    session = transitionPomodoro(session, { type: 'START' });
    session = transitionPomodoro(session, { type: 'FOCUS_COMPLETE' });
    session = transitionPomodoro(session, { type: 'BREAK_COMPLETE' });
    session = transitionPomodoro(session, { type: 'FOCUS_COMPLETE' });

    expect(session.state).toBe('LONG_BREAK');
    expect(getPhaseDurationMinutes(session)).toBe(15);
  });

  it('marks cancelled sessions as interrupted', () => {
    let session = createPomodoroSession('p4');
    session = transitionPomodoro(session, { type: 'START' });
    session = transitionPomodoro(session, { type: 'CANCEL' });

    expect(session.state).toBe('IDLE');
    expect(session.interrupted).toBe(true);
    expect(session.active).toBe(false);
  });

  describe('isPhaseAbandoned', () => {
    it('is not abandoned while the phase is still running or only just over', () => {
      let session = createPomodoroSession('p5');
      session = transitionPomodoro(session, { type: 'START' });
      const startedAtMs = new Date(session.startedAt as string).getTime();

      expect(isPhaseAbandoned(session, startedAtMs)).toBe(false);
      // 25 min focus, 1 minute overdue -- well within the grace window.
      expect(isPhaseAbandoned(session, startedAtMs + 26 * 60_000)).toBe(false);
    });

    it('is abandoned once overdue past the phase duration by more than the grace window', () => {
      let session = createPomodoroSession('p6');
      session = transitionPomodoro(session, { type: 'START' });
      const startedAtMs = new Date(session.startedAt as string).getTime();

      // 25 min focus + grace + 1ms.
      const justUnderGrace = startedAtMs + 25 * 60_000 + ABANDONED_PHASE_GRACE_MS;
      expect(isPhaseAbandoned(session, justUnderGrace)).toBe(false);
      expect(isPhaseAbandoned(session, justUnderGrace + 1)).toBe(true);

      // A session left active for a week is unambiguously abandoned.
      expect(isPhaseAbandoned(session, startedAtMs + 7 * 24 * 60 * 60_000)).toBe(true);
    });

    it('is never abandoned when the session is not active', () => {
      const session = createPomodoroSession('p7');
      expect(isPhaseAbandoned(session, Date.now() + 7 * 24 * 60 * 60_000)).toBe(false);
    });
  });
});

describe('pausing a block ("Salir")', () => {
  const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();
  const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

  function runningBlock(blockEndInMin: number, startedMinAgo: number) {
    const started = transitionPomodoro(createBlockPomodoroSession('s1', 'LIGHT', inMinutes(blockEndInMin)), { type: 'START' });
    return { ...started, startedAt: minutesAgo(startedMinAgo) };
  }

  it('pauses, counts the exit, and stops blocking', () => {
    const paused = transitionPomodoro(runningBlock(60, 10), { type: 'PAUSE' });
    expect(paused.pausedAt).toBeTruthy();
    expect(paused.exitCount).toBe(1);
    expect(isBlockingPhase(paused)).toBe(false);
    // A second pause while paused changes nothing.
    expect(transitionPomodoro(paused, { type: 'PAUSE' })).toBe(paused);
  });

  it('freezes the clock while paused and ignores phase completions', () => {
    const paused = { ...runningBlock(60, 10), pausedAt: minutesAgo(5), exitCount: 1 };
    expect(sessionClock(paused)).toBe(new Date(paused.pausedAt).getTime());
    expect(transitionPomodoro(paused, { type: 'FOCUS_COMPLETE' })).toBe(paused);
    expect(isPhaseAbandoned(paused, Date.now() + 3 * 60 * 60_000)).toBe(false);
  });

  it('resumes where it stopped by moving startedAt forward by the paused time', () => {
    const base = runningBlock(60, 10);
    const paused = { ...base, pausedAt: minutesAgo(5), exitCount: 1 };
    const resumed = transitionPomodoro(paused, { type: 'RESUME' });
    expect(resumed.pausedAt).toBeNull();
    expect(resumed.active).toBe(true);
    const shiftMin = (new Date(resumed.startedAt!).getTime() - new Date(base.startedAt!).getTime()) / 60_000;
    expect(Math.round(shiftMin)).toBe(5);
    expect(resumed.exitCount).toBe(1);
  });

  it('resuming after the block is over ends it cleanly', () => {
    const paused = { ...runningBlock(1, 30), pausedAt: minutesAgo(20), exitCount: 2 };
    const resumed = transitionPomodoro(paused, { type: 'RESUME' });
    expect(resumed.active).toBe(false);
    expect(resumed.interrupted).toBe(false);
    expect(resumed.pausedAt).toBeNull();
  });

  it('a late exit is applied at the moment it happened', () => {
    const at = minutesAgo(3);
    const paused = transitionPomodoro(runningBlock(60, 10), { type: 'PAUSE', at });
    expect(paused.pausedAt).toBe(at);
  });
});
