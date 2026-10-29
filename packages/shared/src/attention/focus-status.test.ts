import { jest } from '@jest/globals';
import { currentFocusStatus, flexibleWorkWindowNow, flexibleWorkWindows, type FocusStatusSchedule } from './focus-status.js';
import { createBlockPomodoroSession, transitionPomodoro } from '../pomodoro/state-machine.js';

// Monday 5 Oct 2026, local time.
const at = (h: number, m = 0) => new Date(2026, 9, 5, h, m);
const b1: FocusStatusSchedule = { id: 'b1', kind: 'WORK', enabled: true, daysOfWeek: [1], startMinute: 9 * 60, endMinute: 10 * 60 + 30, label: 'Estudio B1' };
const tasks = [
  { id: 't', title: '02 · Darboux', scheduledAt: at(9).toISOString(), status: 'PENDING', attentionProfile: 'DEEP' as const },
];

describe('currentFocusStatus', () => {
  it('shows the running block when there is no pomodoro', () => {
    const status = currentFocusStatus({ session: null, schedules: [b1], tasks, now: at(9, 20) });
    expect(status).toMatchObject({ kind: 'schedule', title: 'Horario de trabajo · Estudio B1', text: '09:00-10:30 · Profundo · 02 · Darboux', blockLabel: 'Estudio B1' });
    expect(status!.endsAt.getHours() * 60 + status!.endsAt.getMinutes()).toBe(10 * 60 + 30);
  });

  it('shows the pomodoro phase, its end, the block and the task', () => {
    // Started inside the block: a block that's already over can't be started.
    jest.useFakeTimers({ now: at(9, 5) });
    const started = transitionPomodoro(createBlockPomodoroSession('s', 'DEEP', at(10, 30).toISOString()), { type: 'START', taskId: 't' });
    jest.useRealTimers();
    const session = { ...started, startedAt: at(9, 5).toISOString() };
    const status = currentFocusStatus({ session, schedules: [b1], tasks, now: at(9, 20) });
    expect(status).toMatchObject({ kind: 'pomodoro', title: 'Enfoque · Profundo', text: 'Estudio B1 · 02 · Darboux · ciclo 1' });
    expect(status!.endsAt.getHours() * 60 + status!.endsAt.getMinutes()).toBe(9 * 60 + 45);
    expect(status!.key).toBe('pomodoro:s:FOCUS:0');
  });

  it('is empty outside any block, and once a mechanical block is past its 60 minutes', () => {
    expect(currentFocusStatus({ session: null, schedules: [b1], tasks, now: at(11) })).toBeNull();
    const mechanical = [{ ...tasks[0], attentionProfile: 'MECHANICAL' as const }];
    expect(currentFocusStatus({ session: null, schedules: [b1], tasks: mechanical, now: at(10, 5) })).toBeNull();
  });
});

describe('flexibleWorkWindowNow', () => {
  const flexible: FocusStatusSchedule[] = [
    { ...b1, flexibleBlocks: 1, daysOfWeek: [1, 2, 3, 4, 5] },
    { ...b1, id: 'tarde', flexibleBlocks: 1, daysOfWeek: [1, 2, 3, 4, 5], startMinute: 14 * 60, endMinute: 15 * 60 + 30 },
  ];

  it('is work hours through both windows, between the suggested blocks too', () => {
    expect(flexibleWorkWindowNow(flexible, at(9))?.name).toBe('manana');
    // 10:40: the first block is over and the second hasn't started -- still work hours.
    expect(flexibleWorkWindowNow(flexible, at(10, 40))?.name).toBe('manana');
    expect(flexibleWorkWindowNow(flexible, at(17, 59))?.name).toBe('tarde');
  });

  it('leaves lunch, the evening and days without flexible blocks free', () => {
    expect(flexibleWorkWindowNow(flexible, at(13, 30))).toBeNull();
    expect(flexibleWorkWindowNow(flexible, at(18))).toBeNull();
    expect(flexibleWorkWindowNow(flexible, at(8, 59))).toBeNull();
    // Saturday 10 Oct 2026.
    expect(flexibleWorkWindowNow(flexible, new Date(2026, 9, 10, 10))).toBeNull();
    expect(flexibleWorkWindowNow([b1], at(10))).toBeNull();
    expect(flexibleWorkWindows([{ ...flexible[0], enabled: false }])).toEqual([]);
  });
});
