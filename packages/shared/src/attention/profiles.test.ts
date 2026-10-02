import {
  attentionBlockPlan,
  blockOnDay,
  attentionProfileFor,
  blockAttentionProfile,
  focusMinutes,
  profileBlockEndMinute,
  type AttentionProfile,
} from './profiles.js';
import { createBlockPomodoroSession, getPhaseDurationMinutes, transitionPomodoro } from '../pomodoro/state-machine.js';

const NINE = 9 * 60;
const SCHEDULE_END = NINE + 90;

function shape(profile: AttentionProfile, start = NINE): string {
  const end = profileBlockEndMinute(profile, NINE, SCHEDULE_END);
  return attentionBlockPlan(profile, start, end)
    .map((s) => `${s.type === 'focus' ? 'F' : 'b'}${s.endMinute - s.startMinute}${s.trimmed ? '*' : ''}`)
    .join(' ');
}

describe('attention profiles', () => {
  it('maps (R, C) through the fixed table, clamping out-of-range input', () => {
    expect(attentionProfileFor(0, 0)).toBe('MECHANICAL');
    expect(attentionProfileFor(1, 1)).toBe('LIGHT');
    expect(attentionProfileFor(2, 2)).toBe('LIGHT');
    expect(attentionProfileFor(2, 3)).toBe('DEEP');
    expect(attentionProfileFor(3, 2)).toBe('DEEP');
    expect(attentionProfileFor(9, -1)).toBe('LIGHT');
  });

  it('gives a block the profile of its most demanding task, LIGHT when none is rated', () => {
    expect(blockAttentionProfile(['MECHANICAL', 'DEEP', null])).toBe('DEEP');
    expect(blockAttentionProfile([null, undefined])).toBe('LIGHT');
  });

  it('runs a mechanical block for 60 minutes and the others for the full 90', () => {
    expect(profileBlockEndMinute('MECHANICAL', NINE, SCHEDULE_END)).toBe(NINE + 60);
    expect(profileBlockEndMinute('DEEP', NINE, SCHEDULE_END)).toBe(SCHEDULE_END);
    // Never past the schedule: a 45-minute window stays 45 even for a 60-minute profile.
    expect(profileBlockEndMinute('MECHANICAL', NINE, NINE + 45)).toBe(NINE + 45);
  });

  it('divides each block exactly', () => {
    expect(shape('MECHANICAL')).toBe('F15 b5 F15 b5 F15 b5');
    expect(shape('LIGHT')).toBe('F25 b5 F25 b5 F25 b5');
    expect(shape('DEEP')).toBe('F40 b5 F40 b5');
    expect(focusMinutes(attentionBlockPlan('DEEP', NINE, SCHEDULE_END))).toBe(80);
  });

  it('fits fewer pomodoros when started late, and skips a tail under 10 minutes', () => {
    expect(shape('DEEP', NINE + 20)).toBe('F40 b5 F25*');
    expect(shape('DEEP', NINE + 82)).toBe('b8');
  });
});

describe('block-mode pomodoro session', () => {
  const minutesFromNow = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

  it('uses the profile lengths and trims the running phase to the block end', () => {
    const session = transitionPomodoro(createBlockPomodoroSession('s', 'DEEP', minutesFromNow(25)), { type: 'START' });
    expect(session.state).toBe('FOCUS');
    expect(session.focusDurationMin).toBe(40);
    expect(session.attentionProfile).toBe('DEEP');
    expect(getPhaseDurationMinutes(session)).toBeCloseTo(25, 1);
  });

  it('does not start with under 10 minutes left in the block', () => {
    const session = transitionPomodoro(createBlockPomodoroSession('s', 'LIGHT', minutesFromNow(5)), { type: 'START' });
    expect(session.state).toBe('IDLE');
  });

  it('only takes short breaks, and ends cleanly when the block does', () => {
    let session = transitionPomodoro(createBlockPomodoroSession('s', 'LIGHT', minutesFromNow(60)), { type: 'START' });
    session = transitionPomodoro(session, { type: 'FOCUS_COMPLETE' });
    expect(session.state).toBe('SHORT_BREAK');

    const over = { ...session, state: 'FOCUS' as const, blockEndAt: minutesFromNow(-1) };
    const ended = transitionPomodoro(over, { type: 'FOCUS_COMPLETE' });
    expect(ended).toMatchObject({ state: 'IDLE', active: false, interrupted: false });
    expect(ended.endedAt).toBeTruthy();

    const tail = transitionPomodoro({ ...session, blockEndAt: minutesFromNow(6) }, { type: 'BREAK_COMPLETE' });
    expect(tail).toMatchObject({ state: 'IDLE', active: false, interrupted: false });
  });
});

describe('blockOnDay', () => {
  const day = new Date(2026, 9, 5); // Monday 5 Oct 2026, local time
  const at = (h: number, m = 0) => new Date(2026, 9, 5, h, m).toISOString();
  const block = { startMinute: 14 * 60, endMinute: 15 * 60 + 30 };

  it('takes the pending tasks inside the window and ends a mechanical block after 60 minutes', () => {
    const tasks = [
      { id: 'a', scheduledAt: at(14), status: 'PENDING', attentionProfile: 'MECHANICAL' as const },
      { id: 'done', scheduledAt: at(14, 10), status: 'COMPLETED', attentionProfile: 'DEEP' as const },
      { id: 'later', scheduledAt: at(16), status: 'PENDING', attentionProfile: 'DEEP' as const },
    ];
    const b = blockOnDay(block, tasks, day);
    expect(b.tasks.map((t) => t.id)).toEqual(['a']);
    expect(b.profile).toBe('MECHANICAL');
    expect([b.startAt.getHours(), b.endAt.getHours(), b.endAt.getMinutes()]).toEqual([14, 15, 0]);
  });

  it('runs the full window, LIGHT, when the block has no rated task', () => {
    const b = blockOnDay(block, [], day);
    expect(b.profile).toBe('LIGHT');
    expect([b.endAt.getHours(), b.endAt.getMinutes()]).toEqual([15, 30]);
  });
});
