import {
  createPomodoroSession,
  getPhaseDurationMinutes,
  isBlockingPhase,
  transitionPomodoro,
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
});
