import type { Schedule } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { LayaClient, layaState, toComplexity } from '../src/planning/complexity';
import { GeminiPlanner, parseAssignments, type GenerateRequest } from '../src/planning/gemini-planner';
import { loadReferenceLineMap } from '../src/planning/line-mapper';
import { HeuristicPlanner } from '../src/planning/heuristic-planner';
import { planningConfig } from '../src/planning/planning.config';
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
  return {
    id, title: id, description: null, category: null, priority: 'MEDIUM', difficulty: 'MEDIUM', complexity: 5, attentionProfile: null,
    pomodoros: 2, scheduledDate: null, line: null, ...overrides,
  };
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

describe('studyLineOrder with split sessions', () => {
  it('orders the sessions of a split unit between its unit neighbours', () => {
    const order = studyLineOrder(['note:p.md#AN1#2', 'note:p.md#AN1#1.2', 'note:p.md#AN1#1.1', 'note:p.md#AN10#1']);
    expect(['note:p.md#AN1#1.1', 'note:p.md#AN1#1.2', 'note:p.md#AN1#2', 'note:p.md#AN10#1'].map((id) => order.get(id)!.order)).toEqual([0, 1, 2, 3]);
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

describe('complexity inside a block', () => {
  // 08:00-13:00 with 40+5 fits 6 pomodoros of 1 each.
  const big = (tasks: PlanningTask[]) => ({ ...context(tasks), slots: buildSlots([schedule({ endMinute: 13 * 60 })], [MON, TUE]) });

  it('puts the hardest task on top of its block and rates the block', () => {
    const tasks = [task('light', { complexity: 3, pomodoros: 1 }), task('hard', { complexity: 9, pomodoros: 1 }), task('mid', { complexity: 6, pomodoros: 2 })];
    const { accepted, blocks } = validatePlan(big(tasks), tasks.map((t) => assign(t.id, MON)));
    expect(accepted.map((a) => [a.taskId, a.startMinute, a.complexity])).toEqual([
      ['hard', 8 * 60, 9],
      ['mid', 8 * 60 + 45, 6],
      ['light', 8 * 60 + 135, 3],
    ]);
    // (9*1 + 6*2 + 3*1) / 4 = 6
    expect(blocks).toEqual([{ scheduleId: 'b1', date: MON, label: 'B1', complexity: 6, load: 'medio', pomodoros: 4, capacity: 6 }]);
  });

  it('ranks by attention profile before complexity', () => {
    const tasks = [task('deep', { attentionProfile: 'DEEP', complexity: 3, pomodoros: 1 }), task('mech', { attentionProfile: 'MECHANICAL', complexity: 9, pomodoros: 1 })];
    const { accepted } = validatePlan(big(tasks), [assign('mech', MON), assign('deep', MON)]);
    expect(accepted.map((a) => a.taskId)).toEqual(['deep', 'mech']);
  });

  it('keeps a study line in pensum order even when a later session is harder', () => {
    const tasks = [
      task('p0', { line: { id: 'p', order: 0 }, complexity: 4, pomodoros: 1 }),
      task('loose', { complexity: 6, pomodoros: 1 }),
      task('p1', { line: { id: 'p', order: 1 }, complexity: 9, pomodoros: 1 }),
    ];
    const { accepted } = validatePlan(big(tasks), tasks.map((t) => assign(t.id, MON)));
    // p1 is the hardest, so the line takes the top slot -- but p0 has to come first in it.
    expect(accepted.map((a) => a.taskId)).toEqual(['p0', 'loose', 'p1']);
  });
});

describe('Laya complexity', () => {
  it('maps the 0-4 score onto 1-10', () => {
    expect([0, 1, 2, 3, 4, 2.35, -1, 9].map(toComplexity)).toEqual([1, 3, 6, 8, 10, 6, 1, 10]);
  });

  it('describes a task with the marks the import put on it', () => {
    expect(layaState(task('t', { title: 'AN1 · Cierre', category: 'Análisis', difficulty: 'HARD', priority: 'LOW' }))).toEqual({
      tarea: 'AN1 · Cierre', materia: 'Análisis', marca: 'Marcada como sesión de cierre difícil.', opcional: 'Sesión opcional o de baja prioridad.',
    });
  });

  it('scores in batches of 64 and fails loudly on a bad answer', async () => {
    const sizes: number[] = [];
    const fetchOk = (async (_url: string, init: RequestInit) => {
      const { states } = JSON.parse(init.body as string) as { states: unknown[] };
      sizes.push(states.length);
      return new Response(JSON.stringify({ results: states.map(() => ({ answers: { complejidad: { score: 4 } } })) }));
    }) as unknown as typeof fetch;
    const tasks = Array.from({ length: 70 }, (_, i) => task(`t${i}`));
    const scores = await new LayaClient('http://laya', fetchOk).score(tasks);
    expect(sizes).toEqual([64, 6]);
    expect(scores.get('t69')).toBe(10);

    const fetchBad = (async () => new Response(JSON.stringify({ results: [] }))) as unknown as typeof fetch;
    await expect(new LayaClient('http://laya', fetchBad).score([task('a')])).rejects.toThrow(/número de resultados/);
  });
});

describe('GeminiPlanner', () => {
  const config = { ...planningConfig({}), geminiApiKey: 'k', geminiModels: ['busy', 'gemini-test'], rulesPath: 'rules.md' };

  it('sends the rules, the blocks and the tasks, and returns the parsed assignments', async () => {
    let seen: GenerateRequest | undefined;
    const planner = new GeminiPlanner(
      config,
      async (req) => {
        if (req.model === 'busy') throw new Error('{"error":{"code":503,"message":"High demand. Try later."}}');
        seen = req;
        return JSON.stringify({ assignments: [{ taskId: 'a', date: MON, scheduleId: 'b1', priority: 'HIGH', reason: 'B1 por la regla' }] });
      },
      async () => 'Estudio B1 = geometría',
    );
    const ctx = context([task('a', { complexity: 8 })]);
    const notes: string[] = [];
    expect(await planner.propose(ctx, notes)).toEqual([{ taskId: 'a', date: MON, scheduleId: 'b1', priority: 'HIGH', reason: 'B1 por la regla' }]);
    // The busy model is skipped and the note says who answered.
    expect(notes).toEqual(['Plan hecho con gemini-test.', 'busy falló: 503 High demand']);
    expect(seen!.model).toBe('gemini-test');
    expect(seen!.system).toContain('Estudio B1 = geometría');
    expect(seen!.prompt).toContain('"scheduleId":"b1"');
    expect(seen!.prompt).toContain('"complejidad":8');
  });

  it('does not call the model when there is nothing to plan', async () => {
    const planner = new GeminiPlanner(config, async () => { throw new Error('should not be called'); }, async () => '');
    expect(await planner.propose(context([]))).toEqual([]);
  });

  it('rejects answers that are not the expected shape', () => {
    expect(() => parseAssignments('{}')).toThrow(/assignments/);
    expect(() => parseAssignments('{"assignments":[{"taskId":1,"scheduleId":null}]}')).toThrow(/taskId/);
    expect(parseAssignments('{"assignments":[{"taskId":"a","date":"x","scheduleId":null,"priority":"LOW","reason":"r"}]}')[0].scheduleId).toBeNull();
  });
});

describe('line-map fallback', () => {
  // Two blocks every weekday: B1 at 08:00 and B2 at 10:00, two pomodoros each.
  const b1 = schedule({ id: 'b1', label: 'Estudio B1' });
  const b2 = schedule({ id: 'b2', label: 'Estudio B2', startMinute: 10 * 60, endMinute: 12 * 60 });
  const geometry = [0, 1].map((order) => task(`g${order}`, { line: { id: 'geo', order }, category: 'Geometría' }));
  const analysis = [0, 1].map((order) => task(`a${order}`, { line: { id: 'ana', order }, category: 'Análisis' }));
  const ctx = (): PlanningContext => ({ ...context([...geometry, ...analysis]), slots: buildSlots([b1, b2], [MON, TUE]) });
  // No reference map in this directory, so the Gemini line map is what's left.
  const config = { ...planningConfig({}), geminiApiKey: 'k', geminiModels: ['flash', 'flash-lite'], rulesPath: 'rules.md', attentionDocsPath: 'no-such-dir' };

  it('when no model returns a whole plan, asks only which block each line goes in and packs with that', async () => {
    const asked: string[] = [];
    const planner = new GeminiPlanner(
      config,
      async (req) => {
        const isMap = JSON.stringify(req.schema).includes('lineas');
        asked.push(`${isMap ? 'map' : 'plan'}:${req.model}`);
        return isMap
          ? JSON.stringify({ lineas: [{ linea: 'geo', bloques: ['b1'] }, { linea: 'ana', bloques: ['b2', 'nope'] }] })
          : JSON.stringify({ assignments: [] });
      },
      async () => 'B1 = geometría, B2 = análisis',
    );
    const notes: string[] = [];
    const plan = await planner.propose(ctx(), notes);
    // The whole plan is never asked of Flash-Lite; the map is asked of the first model that answers.
    expect(asked).toEqual(['plan:flash', 'map:flash']);
    const where = (id: string) => plan.filter((a) => a.taskId.startsWith(id)).map((a) => `${a.date}/${a.scheduleId}`);
    expect(where('g')).toEqual([`${MON}/b1`, `${TUE}/b1`]);
    expect(where('a')).toEqual([`${MON}/b2`, `${TUE}/b2`]);
    expect(notes[0]).toMatch(/flash decidió qué línea va en qué bloque/);
    expect(validatePlan(ctx(), plan).rejected).toEqual([]);
  });

  it('leaves a line the map gives no block to unplaced', () => {
    const plan = new HeuristicPlanner().proposeWith(ctx(), new Map([['geo', new Set(['b1'])], ['ana', new Set<string>()]]));
    expect(plan.every((a) => a.taskId.startsWith('g'))).toBe(true);
  });
});

describe('reference line map', () => {
  const b1 = schedule({ id: 'b1', label: 'Estudio B1 (línea principal)' });
  const b2 = schedule({ id: 'b2', label: 'Estudio B2 (línea paralela)', startMinute: 10 * 60, endMinute: 12 * 60 });
  const career = schedule({ id: 'c', label: 'Maestrías: documentos', startMinute: 14 * 60, endMinute: 16 * 60 });
  const line = (file: string, n: number) => Array.from({ length: n }, (_, order) => task(`${file}#${order}`, { line: { id: file, order } }));
  const tasks = [...line('pensum_geometria_diff_hams.md', 1), ...line('pensum_pilar_C.md', 2), ...line('pensum_analisis.md', 2), task('loose')];
  const days = [MON, TUE, '2026-10-07'];
  const ctx = (): PlanningContext => ({ ...context(tasks), days, slots: buildSlots([b1, b2, career], days) });

  it('loads docs/planning/mapa-lineas.json and matches blocks by title', async () => {
    const ref = await loadReferenceLineMap(`${__dirname}/../../docs/planning`, ctx());
    expect([...ref!.sequence.keys()].sort()).toEqual(['b1', 'b2']);
    expect(ref!.sequence.get('b1')![0]).toBe('pensum_geometria_diff_hams.md');
  });

  it('finishes a line before the next in a block, keeps study out of other blocks and loose tasks waiting', async () => {
    const ref = await loadReferenceLineMap(`${__dirname}/../../docs/planning`, ctx());
    const plan = new HeuristicPlanner().proposeWith(ctx(), ref!.map, ref!.sequence);
    const at = (id: string) => plan.find((a) => a.taskId === id);
    expect([at('pensum_geometria_diff_hams.md#0')?.date, at('pensum_pilar_C.md#0')?.date, at('pensum_pilar_C.md#1')?.date]).toEqual([MON, TUE, '2026-10-07']);
    expect(plan.filter((a) => a.taskId.startsWith('pensum_analisis')).every((a) => a.scheduleId === 'b2')).toBe(true);
    expect(plan.some((a) => a.scheduleId === 'c' || a.taskId === 'loose')).toBe(false);
    expect(validatePlan(ctx(), plan).rejected).toEqual([]);
  });

  it('is what the Gemini planner falls back to when every model fails', async () => {
    const docs = `${__dirname}/../../docs/planning`;
    const planner = new GeminiPlanner(
      { ...planningConfig({}), geminiApiKey: 'k', geminiModels: ['busy'], rulesPath: 'rules.md', attentionDocsPath: docs },
      async () => {
        throw new Error('{"error":{"code":503,"message":"High demand. Later."}}');
      },
      async () => 'reglas',
    );
    const notes: string[] = [];
    const plan = await planner.propose(ctx(), notes);
    expect(plan.length).toBeGreaterThan(0);
    expect(notes[0]).toMatch(/mapa de referencia/);
  });
});
