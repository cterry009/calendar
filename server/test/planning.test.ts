import type { Schedule } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { HeuristicPlanner } from '../src/planning/heuristic-planner';
import { validatePlan } from '../src/planning/plan-validator';
import type { Assignment, PlanningContext, PlanningTask } from '../src/planning/planning.types';
import { blockCapacity, buildSlots, toLocal } from '../src/planning/slots';
import { studyLineOrder } from '../src/planning/study-line';

// Planning (task 8.13) is pure logic over a context, so these run without touching the database.

function schedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 'b1', userId: 'u', kind: 'WORK', daysOfWeek: [1, 2, 3, 4, 5], startMinute: 8 * 60, endMinute: 10 * 60,
    label: 'B1', enabled: true, createdAt: new Date(), updatedAt: new Date(),
    pomodoroMin: 40, shortBreakMin: 5, longBreakMin: null, pomodorosPerChunk: null, chunks: null,
    ...overrides,
  };
}

function task(id: string, overrides: Partial<PlanningTask> = {}): PlanningTask {
  return { id, title: id, category: null, priority: 'MEDIUM', pomodoros: 2, scheduledDate: null, line: null, ...overrides };
}

// 2026-10-05 is a Monday.
const MON = '2026-10-05';
const TUE = '2026-10-06';

function context(tasks: PlanningTask[], overrides: Partial<PlanningContext> = {}): PlanningContext {
  const days = [MON, TUE];
  return { days, tasks, scheduled: [], slots: buildSlots([schedule()], days), ...overrides };
}

function assign(taskId: string, date: string, scheduleId: string | null = 'b1'): Assignment {
  return { taskId, date, scheduleId, priority: 'MEDIUM', reason: 'test' };
}

describe('slots', () => {
  it('packs pomodoro + short break into the window, or uses the explicit plan', () => {
    // 120 min: 40+5+40+5 = 90, a third 40 would end at 130 -> 2.
    expect(blockCapacity(schedule())).toBe(2);
    expect(blockCapacity(schedule({ endMinute: 8 * 60 + 130 }))).toBe(3);
    expect(blockCapacity(schedule({ pomodorosPerChunk: 4, chunks: 2 }))).toBe(8);
  });

  it('only builds slots for enabled WORK schedules on their days', () => {
    const slots = buildSlots(
      [schedule(), schedule({ id: 'rest', kind: 'REST' }), schedule({ id: 'off', enabled: false }), schedule({ id: 'sat', daysOfWeek: [6] })],
      [MON, '2026-10-10'],
    );
    expect(slots.map((s) => `${s.scheduleId}@${s.date}`)).toEqual([`b1@${MON}`, 'sat@2026-10-10']);
  });

  it('converts an instant to the local date and minute', () => {
    expect(toLocal(new Date('2026-10-06T03:30:00Z'), 'America/Bogota')).toEqual({ date: MON, minute: 22 * 60 + 30 });
  });
});

describe('studyLineOrder', () => {
  it('orders a pensum by note (numeric) then session, and ignores non-study tasks', () => {
    const order = studyLineOrder(['note:p.md#AN10#1', 'note:p.md#AN2#2', 'note:p.md#AN2#1', 'other', null, 'note:q.md#1#1']);
    expect(order.get('note:p.md#AN2#1')).toEqual({ id: 'p.md', order: 0 });
    expect(order.get('note:p.md#AN2#2')).toEqual({ id: 'p.md', order: 1 });
    expect(order.get('note:p.md#AN10#1')).toEqual({ id: 'p.md', order: 2 });
    expect(order.get('note:q.md#1#1')).toEqual({ id: 'q.md', order: 0 });
    expect(order.has('other')).toBe(false);
  });
});

describe('validatePlan', () => {
  it('accepts a fitting plan and places tasks one after another inside the block', () => {
    const ctx = context([task('a', { pomodoros: 1 }), task('b', { pomodoros: 1 })]);
    const { accepted, rejected } = validatePlan(ctx, [assign('a', MON), assign('b', MON)]);
    expect(rejected).toEqual([]);
    expect(accepted.map((a) => a.startMinute)).toEqual([480, 525]);
  });

  it('rejects overfilling a block, counting what is already there', () => {
    const ctx = context([task('a'), task('b', { pomodoros: 1 })]);
    ctx.slots[0].used = 1;
    const { accepted, rejected } = validatePlan(ctx, [assign('a', MON), assign('b', MON)]);
    expect(rejected.map((r) => r.assignment.taskId)).toEqual(['a']);
    expect(rejected[0].reasons[0]).toMatch(/necesita 2 pomodoros y quedan 1/);
    expect(accepted.map((a) => [a.taskId, a.startMinute])).toEqual([['b', 480 + 45]]);
  });

  it('rejects unknown tasks, duplicates, dates outside the horizon, bad priorities and non-WORK blocks', () => {
    const ctx = context([task('a', { pomodoros: 1 }), task('b', { pomodoros: 1 }), task('c', { pomodoros: 1 })]);
    const { accepted, rejected } = validatePlan(ctx, [
      assign('ghost', MON),
      assign('a', MON),
      assign('a', TUE),
      assign('b', '2026-12-01'),
      { ...assign('c', MON), priority: 'URGENT' as never },
      assign('c', MON, 'rest-block'),
    ]);
    expect(accepted.map((a) => a.taskId)).toEqual(['a']);
    expect(rejected).toHaveLength(5);
  });

  it('accepts "that day, whenever" tasks without a block', () => {
    const { accepted } = validatePlan(context([task('a', { pomodoros: 9 })]), [assign('a', TUE, null)]);
    expect(accepted).toEqual([expect.objectContaining({ taskId: 'a', scheduleId: null, startMinute: null })]);
  });

  it('rejects a study session placed before an earlier one, or with an earlier one left undated', () => {
    const s = (n: number) => task(`s${n}`, { pomodoros: 1, line: { id: 'p.md', order: n } });
    const ctx = context([s(0), s(1), s(2)]);
    const { accepted, rejected } = validatePlan(ctx, [assign('s1', MON), assign('s0', TUE)]);
    expect(accepted.map((a) => a.taskId)).toEqual(['s0']);
    expect(rejected[0].reasons[0]).toMatch(/orden del pensum.*s0.*2026-10-06/);
  });

  it('cascades: when a session is dropped for capacity, the ones after it lose their place too', () => {
    const s = (n: number, pomodoros: number) => task(`s${n}`, { pomodoros, line: { id: 'p.md', order: n } });
    const ctx = context([s(0, 3), s(1, 1)]);
    const { accepted, rejected } = validatePlan(ctx, [assign('s0', MON), assign('s1', TUE)]);
    expect(accepted).toEqual([]);
    expect(rejected.map((r) => r.assignment.taskId).sort()).toEqual(['s0', 's1']);
  });

  it('counts sessions already on the calendar for the order', () => {
    const ctx = context([task('s1', { pomodoros: 1, line: { id: 'p.md', order: 1 } })], {
      scheduled: [task('s0', { line: { id: 'p.md', order: 0 }, scheduledDate: TUE })],
    });
    expect(validatePlan(ctx, [assign('s1', MON)]).accepted).toEqual([]);
    expect(validatePlan(ctx, [assign('s1', TUE)]).accepted).toHaveLength(1);
  });
});

describe('HeuristicPlanner', () => {
  const planner = new HeuristicPlanner();

  it('alternates study lines, keeps each in order, and everything it proposes validates', async () => {
    const line = (id: string, n: number) => task(`${id}${n}`, { pomodoros: 1, line: { id, order: n } });
    const ctx = context([line('A', 1), line('A', 0), line('B', 0), line('B', 1)]);
    const plan = await planner.propose(ctx);
    expect(plan.map((a) => `${a.taskId}@${a.date}`)).toEqual([`A0@${MON}`, `B0@${MON}`, `A1@${TUE}`, `B1@${TUE}`]);
    expect(validatePlan(ctx, plan).rejected).toEqual([]);
  });

  it('puts high-priority loose tasks first and leaves what does not fit unplaced', async () => {
    const ctx = context([task('low', { priority: 'LOW' }), task('high', { priority: 'HIGH' }), task('big', { pomodoros: 5 })]);
    const plan = await planner.propose(ctx);
    expect(plan.map((a) => `${a.taskId}@${a.date}`)).toEqual([`high@${MON}`, `low@${TUE}`]);
  });

  it('does not continue a line before the date of its already-scheduled earlier session', async () => {
    const ctx = context([task('s1', { pomodoros: 1, line: { id: 'p', order: 1 } })], {
      scheduled: [task('s0', { line: { id: 'p', order: 0 }, scheduledDate: TUE })],
    });
    expect((await planner.propose(ctx)).map((a) => a.date)).toEqual([TUE]);
  });
});
