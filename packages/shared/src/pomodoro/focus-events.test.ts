import { pomodoroTransitionEvents } from './focus-events.js';
import { createBlockPomodoroSession, createPomodoroSession, transitionPomodoro } from './state-machine.js';

const NOW = Date.parse('2026-10-05T14:30:00.000Z');
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();
const kinds = (events: ReturnType<typeof pomodoroTransitionEvents>) => events.map((e) => e.kind);

describe('pomodoroTransitionEvents', () => {
  it('logs the start of a new session', () => {
    const started = transitionPomodoro(createPomodoroSession('s'), { type: 'START' });
    expect(pomodoroTransitionEvents(null, started, undefined, NOW)).toEqual([{ kind: 'FOCUS_STARTED', meta: { cycle: 1 } }]);
  });

  it('logs a completed focus with how long it ran, then the break-to-focus switch', () => {
    const focus = { ...transitionPomodoro(createPomodoroSession('s'), { type: 'START' }), startedAt: minutesAgo(25) };
    const onBreak = { ...transitionPomodoro(focus, { type: 'FOCUS_COMPLETE' }), startedAt: minutesAgo(5) };
    expect(pomodoroTransitionEvents(focus, onBreak, undefined, NOW)).toEqual([{ kind: 'FOCUS_COMPLETED', value: 1500 }]);
    const back = transitionPomodoro(onBreak, { type: 'BREAK_COMPLETE' });
    expect(kinds(pomodoroTransitionEvents(onBreak, back, undefined, NOW))).toEqual(['BREAK_COMPLETED', 'FOCUS_STARTED']);
  });

  it('tells a cancel (with its reason) from a block that ran to its end', () => {
    const focus = { ...transitionPomodoro(createPomodoroSession('s'), { type: 'START' }), startedAt: minutesAgo(12) };
    const cancelled = transitionPomodoro(focus, { type: 'CANCEL' });
    expect(pomodoroTransitionEvents(focus, cancelled, 'abandoned', NOW)).toEqual([
      { kind: 'SESSION_CANCELLED', value: 720, meta: { state: 'FOCUS', completedCycles: 0, reason: 'abandoned' } },
    ]);

    const block = transitionPomodoro(createBlockPomodoroSession('b', 'DEEP', new Date(Date.now() + 60 * 60_000).toISOString()), { type: 'START' });
    const ended = transitionPomodoro({ ...block, blockEndAt: new Date(Date.now() - 1000).toISOString() }, { type: 'FOCUS_COMPLETE' });
    expect(kinds(pomodoroTransitionEvents(block, ended, undefined, NOW))).toEqual(['FOCUS_COMPLETED', 'BLOCK_ENDED']);
  });

  it('logs nothing about the old session when a new one replaces it', () => {
    const old = transitionPomodoro(createPomodoroSession('old'), { type: 'CANCEL' });
    const fresh = transitionPomodoro(createPomodoroSession('new'), { type: 'START' });
    expect(kinds(pomodoroTransitionEvents(old, fresh, undefined, NOW))).toEqual(['FOCUS_STARTED']);
  });
});
