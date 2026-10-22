import { describe, expect, it } from 'vitest';
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SyncBatchDto } from '../src/sync/dto/sync-batch.dto';
import { at, useSyncHarness } from './harness';

// SyncService owns every conflict rule in the project, and a bug there doesn't crash -- it
// quietly loses or resurrects a row. Each test pins one rule against a real Postgres (task 12.9).

const h = useSyncHarness();

/** A real WORK block: a block session for one that doesn't exist is stored already ended. */
async function workBlock(): Promise<string> {
  const schedule = await h.prisma.schedule.create({
    data: { userId: h.userId, kind: 'WORK', daysOfWeek: [1], startMinute: 540, endMinute: 630 },
  });
  return schedule.id;
}

function task(overrides: Record<string, unknown> = {}) {
  return { clientId: 'task-1', updatedAt: at(0), title: 'Leer AN1', estimatedMinutes: 40, ...overrides };
}

describe('pomodoro sessions', () => {
  it('keeps the id the client created the session with, so a retry updates the same row', async () => {
    const session = { id: '0f2c9a4e-1111-4c5e-9f3a-1b2c3d4e5f60', updatedAt: at(0), state: 'FOCUS', active: true, attentionProfile: 'DEEP' };
    await h.batch({ pomodoroSessions: [session] });
    await h.batch({ pomodoroSessions: [{ ...session, updatedAt: at(1), state: 'IDLE', active: false, interrupted: true }] });
    const rows = await h.prisma.pomodoroSession.findMany({ where: { userId: h.userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: session.id, state: 'IDLE', attentionProfile: 'DEEP' });
  });

  it('stores the block, the pause and the exit count from the very first change', async () => {
    // Found on the device 2026-10-06: only updates stored these, so a block session created on the
    // PC reached the phone without its block.
    const scheduleId = await workBlock();
    const session = { id: 'block-s1-2026-10-06', updatedAt: at(0), state: 'FOCUS', active: true, scheduleId };
    await h.batch({ pomodoroSessions: [session] });
    let row = await h.prisma.pomodoroSession.findFirstOrThrow({ where: { userId: h.userId } });
    expect(row).toMatchObject({ scheduleId, pausedAt: null, exitCount: 0 });

    await h.batch({ pomodoroSessions: [{ ...session, updatedAt: at(1), pausedAt: at(1), exitCount: 1 }] });
    row = await h.prisma.pomodoroSession.findFirstOrThrow({ where: { userId: h.userId } });
    expect(row).toMatchObject({ scheduleId, exitCount: 1 });
    expect(row.pausedAt?.toISOString()).toBe(at(1));
  });
});

describe('block sessions of blocks that no longer exist (2026-10-16)', () => {
  it('stores a session started for a deleted block as already ended', async () => {
    // The desktop, still on its cached old blocks, started one the timetable had replaced.
    await h.batch({ pomodoroSessions: [{ id: 'block-gone-2026-10-16', updatedAt: at(0), state: 'FOCUS', active: true, scheduleId: 'gone' }] });
    const row = await h.prisma.pomodoroSession.findFirstOrThrow({ where: { userId: h.userId } });
    expect(row).toMatchObject({ active: false, state: 'IDLE', interrupted: true });
    expect(row.endedAt).not.toBeNull();
  });

  it('ends the running session of a block when the block is deleted', async () => {
    const scheduleId = await workBlock();
    await h.batch({ pomodoroSessions: [{ id: 'block-x-2026-10-16', updatedAt: at(0), state: 'FOCUS', active: true, scheduleId }] });
    // Newer than the block's own (real-clock) updatedAt, or the delete is a conflict.
    await h.batch({ schedules: [{ id: scheduleId, deleted: true, updatedAt: new Date(Date.now() + 60_000).toISOString() }] });
    const row = await h.prisma.pomodoroSession.findFirstOrThrow({ where: { userId: h.userId } });
    expect(row).toMatchObject({ active: false, state: 'IDLE' });
  });
});

describe('pomodoro reviews across devices', () => {
  it('keeps the highest reviewed cycle, so a device that missed a review cannot undo it', async () => {
    const session = { id: 'block-s2-2026-10-07', updatedAt: at(0), state: 'FOCUS', active: true, scheduleId: await workBlock() };
    await h.batch({ pomodoroSessions: [{ ...session, completedCycles: 1, reviewedCycles: 1 }] });
    // The other device moves the session on with its stale copy (reviewedCycles 0).
    await h.batch({ pomodoroSessions: [{ ...session, updatedAt: at(1), state: 'SHORT_BREAK', completedCycles: 1, reviewedCycles: 0 }] });
    const row = await h.prisma.pomodoroSession.findFirstOrThrow({ where: { userId: h.userId } });
    expect(row).toMatchObject({ state: 'SHORT_BREAK', reviewedCycles: 1 });
  });
});

describe('schedule completions: done and "no puedo"', () => {
  it('marks a block skipped, and the same day marked done later becomes done', async () => {
    const schedule = await h.prisma.schedule.create({
      data: { userId: h.userId, kind: 'WORK', daysOfWeek: [2], startMinute: 540, endMinute: 630 },
    });
    await h.batch({ scheduleCompletions: [{ clientId: 'c1', updatedAt: at(0), scheduleId: schedule.id, date: '2026-10-06', status: 'SKIPPED', reason: 'cita médica' }] });
    let rows = await h.prisma.scheduleCompletion.findMany({ where: { userId: h.userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'SKIPPED', reason: 'cita médica' });

    await h.batch({ scheduleCompletions: [{ clientId: 'c2', updatedAt: at(1), scheduleId: schedule.id, date: '2026-10-06' }] });
    rows = await h.prisma.scheduleCompletion.findMany({ where: { userId: h.userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'DONE', reason: null });
  });
});

describe('attention rating on tasks', () => {
  it('stores the rating, and a change that omits it leaves it alone', async () => {
    await h.batch({ tasks: [task({ attentionReentry: 3, attentionLoad: 2, attentionProfile: 'DEEP', attentionSource: 'MODEL', attentionReason: 'Derivación larga.' })] });
    await h.batch({ tasks: [task({ updatedAt: at(1), title: 'Leer AN1 (editado)' })] });
    const row = await h.prisma.task.findFirstOrThrow({ where: { userId: h.userId } });
    expect(row).toMatchObject({ title: 'Leer AN1 (editado)', attentionReentry: 3, attentionLoad: 2, attentionProfile: 'DEEP', attentionSource: 'MODEL' });
  });
});

describe('updatedAt wins (tasks)', () => {
  it('creates from a clientId and updates the same row on a newer change', async () => {
    await h.batch({ tasks: [task()] });
    const created = await h.prisma.task.findFirstOrThrow({ where: { userId: h.userId } });

    const result = await h.batch({ tasks: [task({ id: created.id, updatedAt: at(5), title: 'Leer AN1 cap. 2' })] });

    expect(result.applied.tasks?.[0].status).toBe('applied');
    const rows = await h.prisma.task.findMany({ where: { userId: h.userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Leer AN1 cap. 2');
  });

  it('retrying the same clientId (offline queue flushed twice) does not duplicate', async () => {
    await h.batch({ tasks: [task()] });
    await h.batch({ tasks: [task({ updatedAt: at(1) })] });
    expect(await h.prisma.task.count({ where: { userId: h.userId } })).toBe(1);
  });

  it('an older change is a conflict: returns the server row and does not overwrite it', async () => {
    await h.batch({ tasks: [task({ updatedAt: at(10), title: 'Nuevo' })] });
    const { id } = await h.prisma.task.findFirstOrThrow({ where: { userId: h.userId } });

    const result = await h.batch({ tasks: [task({ id, updatedAt: at(5), title: 'Viejo' })] });

    expect(result.applied.tasks).toBeUndefined();
    expect(result.conflicts.tasks?.[0].status).toBe('conflict');
    expect((result.conflicts.tasks?.[0].server as { title: string }).title).toBe('Nuevo');
    expect((await h.prisma.task.findUniqueOrThrow({ where: { id } })).title).toBe('Nuevo');
  });

  it('an older delete does not resurrect-or-kill a newer edit', async () => {
    await h.batch({ tasks: [task({ updatedAt: at(10) })] });
    const { id } = await h.prisma.task.findFirstOrThrow({ where: { userId: h.userId } });

    const result = await h.batch({ tasks: [{ id, deleted: true, updatedAt: at(5) }] });

    expect(result.conflicts.tasks?.[0].status).toBe('conflict');
    expect((await h.prisma.task.findUniqueOrThrow({ where: { id } })).deletedAt).toBeNull();
  });

  it('a newer delete soft-deletes, and the pull stops returning it', async () => {
    await h.batch({ tasks: [task()] });
    const { id } = await h.prisma.task.findFirstOrThrow({ where: { userId: h.userId } });

    await h.batch({ tasks: [{ id, deleted: true, updatedAt: at(5) }] });

    expect((await h.prisma.task.findUniqueOrThrow({ where: { id } })).deletedAt).not.toBeNull();
    expect((await h.pull()).tasks).toHaveLength(0);
  });

  it("never touches another user's row, even when given its id", async () => {
    await h.batch({ tasks: [task({ title: 'De otro' })] }, h.otherUserId);
    const theirs = await h.prisma.task.findFirstOrThrow({ where: { userId: h.otherUserId } });

    await h.batch({ tasks: [task({ id: theirs.id, clientId: undefined, updatedAt: at(30), title: 'Pisado' })] });

    expect((await h.prisma.task.findUniqueOrThrow({ where: { id: theirs.id } })).title).toBe('De otro');
    expect((await h.pull(h.otherUserId)).tasks).toHaveLength(1);
  });
});

describe('max()-merge for sensor totals (steps, floors)', () => {
  it('keeps the larger step count when two devices report the same day', async () => {
    await h.batch({ dailyStepCounts: [{ date: '2026-09-28T00:00:00.000Z', steps: 6000, updatedAt: at(0) }] });
    await h.batch({ dailyStepCounts: [{ date: '2026-09-28T00:00:00.000Z', steps: 7500, updatedAt: at(20) }] });
    // Last and newest, from a device that saw fewer steps: must not lower the total.
    await h.batch({ dailyStepCounts: [{ date: '2026-09-28T00:00:00.000Z', steps: 4000, updatedAt: at(30) }] });

    const rows = await h.prisma.dailyStepCount.findMany({ where: { userId: h.userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].steps).toBe(7500);
  });

  it('does the same for floors', async () => {
    await h.batch({ dailyFloorsClimbed: [{ date: '2026-09-28T00:00:00.000Z', floors: 12, updatedAt: at(0) }] });
    await h.batch({ dailyFloorsClimbed: [{ date: '2026-09-28T00:00:00.000Z', floors: 8, updatedAt: at(10) }] });
    expect((await h.prisma.dailyFloorsClimbed.findFirstOrThrow({ where: { userId: h.userId } })).floors).toBe(12);
  });
});

describe('per-day rollups keyed (userId, date)', () => {
  it('a second screen-time push for the same day updates the row instead of adding one', async () => {
    const day = '2026-09-28T00:00:00.000Z';
    await h.batch({ dailyScreenTime: [{ date: day, totalMinutes: 30, topApps: [], updatedAt: at(0) }] });
    await h.batch({ dailyScreenTime: [{ date: day, totalMinutes: 95, topApps: [], updatedAt: at(60) }] });

    const rows = await h.prisma.dailyScreenTime.findMany({ where: { userId: h.userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].totalMinutes).toBe(95);
  });

  it('an older rollup for the same day is a conflict, not an overwrite (game and desktop app time too)', async () => {
    const day = '2026-09-28T00:00:00.000Z';
    await h.batch({
      dailyGameTime: [{ date: day, totalMinutes: 120, topGames: [], updatedAt: at(60) }],
      dailyDesktopAppTime: [{ date: day, totalMinutes: 300, topApps: [], updatedAt: at(60) }],
    });

    const result = await h.batch({
      dailyGameTime: [{ date: day, totalMinutes: 10, topGames: [], updatedAt: at(0) }],
      dailyDesktopAppTime: [{ date: day, totalMinutes: 10, topApps: [], updatedAt: at(0) }],
    });

    expect(result.conflicts.dailyGameTime).toHaveLength(1);
    expect(result.conflicts.dailyDesktopAppTime).toHaveLength(1);
    expect((await h.prisma.dailyGameTime.findFirstOrThrow({ where: { userId: h.userId } })).totalMinutes).toBe(120);
    expect((await h.prisma.dailyDesktopAppTime.findFirstOrThrow({ where: { userId: h.userId } })).totalMinutes).toBe(300);
  });

  it('buckets by UTC day: two timestamps on the same UTC day share one row', async () => {
    await h.batch({ dailyStepCounts: [{ date: '2026-09-28T03:00:00.000Z', steps: 100, updatedAt: at(0) }] });
    await h.batch({ dailyStepCounts: [{ date: '2026-09-28T22:00:00.000Z', steps: 900, updatedAt: at(1) }] });

    const rows = await h.prisma.dailyStepCount.findMany({ where: { userId: h.userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].date.toISOString()).toBe('2026-09-28T00:00:00.000Z');
  });

  it('documents the known timezone gap: 23:30 local (UTC-5) lands on the next UTC day', async () => {
    // Characterization, not an endorsement: clients still send a UTC-based date for steps, so a
    // late-evening push in Colombia credits tomorrow. When the steps/floors timezone pass lands,
    // this test should flip to expect 2026-09-28.
    await h.batch({ dailyStepCounts: [{ date: '2026-09-28T23:30:00.000-05:00', steps: 500, updatedAt: at(0) }] });
    const row = await h.prisma.dailyStepCount.findFirstOrThrow({ where: { userId: h.userId } });
    expect(row.date.toISOString()).toBe('2026-09-29T00:00:00.000Z');
  });
});

describe('idempotency keys', () => {
  it('a block event retried with the same client UUID is stored once', async () => {
    const event = {
      id: '4b8f0c2e-6a1d-4c5e-9f3a-1b2c3d4e5f60',
      identifier: 'com.instagram.android',
      scope: 'FOCUS',
      trigger: 'BLOCKED_OPEN_ATTEMPT',
      occurredAt: new Date().toISOString(),
    };
    const first = await h.batch({ blockEvents: [event] });
    const retry = await h.batch({ blockEvents: [event] });

    expect(first.applied.blockEvents?.[0].status).toBe('applied');
    expect(retry.applied.blockEvents?.[0].status).toBe('skipped');
    expect(await h.prisma.blockEvent.count({ where: { userId: h.userId } })).toBe(1);
  });

  it('the same event sent twice at the same time is stored once, without an error', async () => {
    const event = { id: '5c1d2e3f-0000-4c5e-9f3a-1b2c3d4e5f60', kind: 'FOCUS_STARTED', occurredAt: new Date().toISOString() };
    const results = await Promise.all([h.batch({ focusEvents: [event] }), h.batch({ focusEvents: [event] })]);
    expect(results.map((r) => r.applied.focusEvents?.[0].status).sort()).toEqual(['applied', 'skipped']);
    expect(await h.prisma.focusEvent.count({ where: { userId: h.userId } })).toBe(1);
  });

  it('lists only the user\'s focus events since a date, oldest first', async () => {
    // For the study status export (2026-10-21): the ratings live only in focus events.
    await h.batch({
      focusEvents: [
        { id: 'fe-late', kind: 'CHECK_IN', occurredAt: at(60), value: 4, meta: { review: true, rating: 4 } },
        { id: 'fe-early', kind: 'FOCUS_STARTED', occurredAt: at(30) },
        { id: 'fe-old', kind: 'FOCUS_STARTED', occurredAt: at(0) },
      ],
    });
    await h.batch({ focusEvents: [{ id: 'fe-other', kind: 'CHECK_IN', occurredAt: at(45), value: 2 }] }, h.otherUserId);

    const events = await h.service.listFocusEvents(h.userId, new Date(at(10)));
    expect(events.map((e) => e.id)).toEqual(['fe-early', 'fe-late']);
  });

  it('a focus event retried with the same client UUID is stored once, with its fields', async () => {
    const event = {
      id: '9a1b2c3d-0000-4c5e-9f3a-1b2c3d4e5f60',
      kind: 'BLOCK_PROMPT_ACCEPTED',
      occurredAt: '2026-10-05T14:03:00.000Z',
      blockStartAt: '2026-10-05T14:00:00.000Z',
      scheduleId: 'b1',
      attentionProfile: 'DEEP',
      value: 180,
      meta: { source: 'notification' },
    };
    const first = await h.batch({ focusEvents: [event] });
    const retry = await h.batch({ focusEvents: [event] });

    expect(first.applied.focusEvents?.[0].status).toBe('applied');
    expect(retry.applied.focusEvents?.[0].status).toBe('skipped');
    const rows = await h.prisma.focusEvent.findMany({ where: { userId: h.userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'BLOCK_PROMPT_ACCEPTED', attentionProfile: 'DEEP', value: 180, meta: { source: 'notification' } });
  });

  it('a habit check-in retried under a new clientId merges on (habit, day) instead of failing', async () => {
    await h.batch({ habits: [{ clientId: 'habit-1', updatedAt: at(0), title: 'Sacar al perro' }] });
    const habit = await h.prisma.habit.findFirstOrThrow({ where: { userId: h.userId } });
    const checkIn = { habitId: habit.id, date: '2026-09-28', value: 1, status: 'DONE' };

    await h.batch({ habitRecords: [{ ...checkIn, clientId: 'phone-attempt', updatedAt: at(1) }] });
    const second = await h.batch({ habitRecords: [{ ...checkIn, clientId: 'pc-attempt', updatedAt: at(2) }] });

    expect(second.applied.habitRecords?.[0].status).toBe('applied');
    expect(await h.prisma.habitRecord.count({ where: { userId: h.userId } })).toBe(1);
  });
});

describe('schedule completions (marcar bloque hecho)', () => {
  async function workBlock() {
    await h.batch({
      schedules: [{ updatedAt: at(0), kind: 'WORK', daysOfWeek: [1], startMinute: 540, endMinute: 630, label: 'Estudio B1' }],
    });
    return h.prisma.schedule.findFirstOrThrow({ where: { userId: h.userId } });
  }

  it('marking the same block from two devices keeps one row; undo removes it', async () => {
    const schedule = await workBlock();
    const mark = { scheduleId: schedule.id, date: '2026-09-28', updatedAt: at(1) };

    await h.batch({ scheduleCompletions: [{ ...mark, clientId: 'phone' }] });
    await h.batch({ scheduleCompletions: [{ ...mark, clientId: 'pc' }] }, h.userId, 'pc');
    expect(await h.prisma.scheduleCompletion.count({ where: { userId: h.userId } })).toBe(1);

    await h.batch({ scheduleCompletions: [{ scheduleId: schedule.id, date: '2026-09-28', deleted: true, updatedAt: at(2) }] });
    expect(await h.prisma.scheduleCompletion.count({ where: { userId: h.userId } })).toBe(0);
  });

  it("can't mark another user's block", async () => {
    await h.batch(
      { schedules: [{ updatedAt: at(0), kind: 'WORK', daysOfWeek: [1], startMinute: 540, endMinute: 630 }] },
      h.otherUserId,
    );
    const theirs = await h.prisma.schedule.findFirstOrThrow({ where: { userId: h.otherUserId } });

    const result = await h.batch({
      scheduleCompletions: [{ clientId: 'x', scheduleId: theirs.id, date: '2026-09-28', updatedAt: at(1) }],
    });

    expect(result.applied.scheduleCompletions?.[0].status).toBe('skipped');
    expect(await h.prisma.scheduleCompletion.count()).toBe(0);
  });

  it('is removed with its schedule (cascade)', async () => {
    const schedule = await workBlock();
    await h.batch({ scheduleCompletions: [{ clientId: 'c', scheduleId: schedule.id, date: '2026-09-28', updatedAt: at(1) }] });

    await h.batch({ schedules: [{ id: schedule.id, deleted: true, updatedAt: at(5) }] });

    expect(await h.prisma.scheduleCompletion.count()).toBe(0);
  });
});

describe('habits are full replaces', () => {
  it('an edit that omits the time block clears it (clients must always send it)', async () => {
    await h.batch({
      habits: [{ clientId: 'h', updatedAt: at(0), title: 'Deporte', reminderStartMinute: 420, reminderEndMinute: 480 }],
    });
    const habit = await h.prisma.habit.findFirstOrThrow({ where: { userId: h.userId } });

    await h.batch({ habits: [{ id: habit.id, updatedAt: at(1), title: 'Deporte antes de las 8' }] });

    const updated = await h.prisma.habit.findUniqueOrThrow({ where: { id: habit.id } });
    expect(updated.title).toBe('Deporte antes de las 8');
    expect(updated.reminderEndMinute).toBeNull();
  });
});

describe('pull snapshot', () => {
  it('bounds block events to the last 30 days and completions to the last 60', async () => {
    const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    await h.prisma.blockEvent.createMany({
      data: [
        { id: 'recent-event', userId: h.userId, scope: 'FOCUS', trigger: 'BLOCKED_OPEN_ATTEMPT', occurredAt: daysAgo(1) },
        { id: 'old-event', userId: h.userId, scope: 'FOCUS', trigger: 'BLOCKED_OPEN_ATTEMPT', occurredAt: daysAgo(45) },
      ],
    });
    const schedule = await h.prisma.schedule.create({
      data: { userId: h.userId, kind: 'WORK', daysOfWeek: [1], startMinute: 540, endMinute: 630 },
    });
    await h.prisma.scheduleCompletion.createMany({
      data: [
        { userId: h.userId, scheduleId: schedule.id, date: daysAgo(2) },
        { userId: h.userId, scheduleId: schedule.id, date: daysAgo(90) },
      ],
    });

    const snapshot = await h.pull();

    expect(snapshot.blockEvents).toHaveLength(1);
    expect(snapshot.scheduleCompletions).toHaveLength(1);
  });

  it("only ever returns the caller's own data", async () => {
    await h.batch({ tasks: [task()] }, h.otherUserId);
    const snapshot = await h.pull();
    expect(snapshot.tasks).toHaveLength(0);
  });
});

describe('realtime notification to other devices', () => {
  it('announces the changed entities, tagged with the source device', async () => {
    await h.batch({ tasks: [task()] }, h.userId, 'pc');
    expect(h.notifications).toEqual([{ userId: h.userId, entities: ['tasks'], sourceDeviceId: 'pc' }]);
  });

  it('stays quiet when nothing was applied (conflict only)', async () => {
    await h.batch({ tasks: [task({ updatedAt: at(10) })] });
    const { id } = await h.prisma.task.findFirstOrThrow({ where: { userId: h.userId } });
    h.notifications.length = 0;

    await h.batch({ tasks: [task({ id, updatedAt: at(0) })] });

    expect(h.notifications).toEqual([]);
  });
});

describe('horario 2026-10-19: sequences, exceptions and the study plan', () => {
  const morning = [
    { tipo: 'foco', minutos: 30, etiqueta: 'P1' },
    { tipo: 'pausa', minutos: 5, etiqueta: 'Pausa' },
    { tipo: 'cierre', minutos: 15, etiqueta: 'Cierre' },
  ];

  it('stores a block category and sequence, and a client that does not send them keeps them', async () => {
    const block = { id: undefined as string | undefined, updatedAt: at(0), kind: 'WORK', daysOfWeek: [1], startMinute: 570, endMinute: 750, label: 'Estudio B1', category: 'estudio_b1', sequence: morning };
    await h.batch({ schedules: [block] });
    const created = await h.prisma.schedule.findFirstOrThrow({ where: { userId: h.userId } });
    expect(created).toMatchObject({ category: 'estudio_b1', sequence: morning });

    // An app from before the change edits the block without the new fields.
    const { category: _c, sequence: _s, ...old } = block;
    await h.batch({ schedules: [{ ...old, id: created.id, updatedAt: at(1), label: 'Estudio B1 (editado)' }] });
    const edited = await h.prisma.schedule.findFirstOrThrow({ where: { userId: h.userId } });
    expect(edited).toMatchObject({ label: 'Estudio B1 (editado)', category: 'estudio_b1', sequence: morning });

    // Explicit null clears it.
    await h.batch({ schedules: [{ ...block, id: created.id, updatedAt: at(2), sequence: null }] });
    expect((await h.prisma.schedule.findFirstOrThrow({ where: { userId: h.userId } })).sequence).toBeNull();
  });

  it('rejects a sequence segment of an unknown type (the global ValidationPipe)', async () => {
    const block = { updatedAt: at(0), kind: 'WORK', daysOfWeek: [1], startMinute: 570, endMinute: 750, sequence: [{ tipo: 'siesta', minutos: 30, etiqueta: 'x' }] };
    const errors = await validate(plainToInstance(SyncBatchDto, { schedules: [block] }), { whitelist: true, forbidNonWhitelisted: true });
    expect(JSON.stringify(errors)).toContain('tipo');
    const ok = await validate(plainToInstance(SyncBatchDto, { schedules: [{ ...block, sequence: morning }] }), { whitelist: true, forbidNonWhitelisted: true });
    expect(ok).toEqual([]);
  });

  it('keeps the session sequence when a device that does not know it pauses, and never lowers the cut count', async () => {
    const session = {
      id: 'block-sq-2026-10-19',
      updatedAt: at(0),
      state: 'FOCUS',
      active: true,
      scheduleId: 'sq',
      blockStartAt: '2026-10-19T14:30:00.000Z',
      blockEndAt: '2026-10-19T17:30:00.000Z',
      sequence: morning,
      segmentIndex: 0,
      cutCount: 1,
    };
    await h.batch({ pomodoroSessions: [session] });
    const { sequence: _s, segmentIndex: _i, blockStartAt: _b, cutCount: _c, ...old } = session;
    await h.batch({ pomodoroSessions: [{ ...old, updatedAt: at(1), pausedAt: at(1), exitCount: 1 }] });
    const row = await h.prisma.pomodoroSession.findFirstOrThrow({ where: { userId: h.userId } });
    expect(row).toMatchObject({ sequence: morning, segmentIndex: 0, cutCount: 1, exitCount: 1 });
    expect(row.blockStartAt?.toISOString()).toBe('2026-10-19T14:30:00.000Z');
  });

  it('syncs flexible morning blocks: the window on the schedule, and focus minutes that never go down (dynamic-study-blocks)', async () => {
    const block = { updatedAt: at(0), kind: 'WORK', daysOfWeek: [1, 2, 4], startMinute: 480, endMinute: 720, label: 'Estudio B1', category: 'estudio_b1', sequence: null, flexibleBlocks: 2 };
    await h.batch({ schedules: [block] });
    const schedule = await h.prisma.schedule.findFirstOrThrow({ where: { userId: h.userId } });
    expect(schedule.flexibleBlocks).toBe(2);
    // An older client edits the block without the field: it stays flexible.
    const { flexibleBlocks: _f, ...old } = block;
    await h.batch({ schedules: [{ ...old, id: schedule.id, updatedAt: at(1), label: 'Estudio B1 (editado)' }] });
    expect((await h.prisma.schedule.findFirstOrThrow({ where: { userId: h.userId } })).flexibleBlocks).toBe(2);

    const session = {
      id: `block-${schedule.id}-2026-10-26-1`,
      updatedAt: at(0),
      state: 'FOCUS',
      active: true,
      scheduleId: schedule.id,
      blockStartAt: '2026-10-26T15:10:00.000Z',
      sequence: [{ tipo: 'foco', minutos: 30, etiqueta: 'P1' }, { tipo: 'pausa', minutos: 5, etiqueta: 'Pausa' }, { tipo: 'cierre', minutos: 15, etiqueta: 'Cierre' }],
      segmentIndex: 0,
      flexible: true,
      plannedBlockMin: 120,
      windowEndAt: '2026-10-26T17:00:00.000Z',
      focusMinutes: 40,
    };
    await h.batch({ pomodoroSessions: [session] });
    // The other device, behind, pushes a lower count; an older one doesn't send the fields at all.
    await h.batch({ pomodoroSessions: [{ ...session, updatedAt: at(1), focusMinutes: 30 }] });
    const { flexible: _x, plannedBlockMin: _p, windowEndAt: _w, focusMinutes: _m, ...older } = session;
    await h.batch({ pomodoroSessions: [{ ...older, updatedAt: at(2), pausedAt: at(2), exitCount: 1 }] });
    const row = await h.prisma.pomodoroSession.findFirstOrThrow({ where: { userId: h.userId } });
    expect(row).toMatchObject({ flexible: true, plannedBlockMin: 120, focusMinutes: 40, exitCount: 1, blockEndAt: null });
    expect(row.windowEndAt?.toISOString()).toBe('2026-10-26T17:00:00.000Z');

    const snapshot = await h.pull();
    expect(snapshot.schedules[0]).toMatchObject({ flexibleBlocks: 2 });
    expect(snapshot.pomodoroSessions[0]).toMatchObject({ flexible: true, focusMinutes: 40 });
  });

  it('keeps one exception per block and day, updates it, and deletes it', async () => {
    const schedule = await h.prisma.schedule.create({
      data: { userId: h.userId, kind: 'WORK', daysOfWeek: [1], startMinute: 840, endMinute: 925, category: 'codigo_academico' },
    });
    await h.batch({ scheduleExceptions: [{ clientId: 'e1', updatedAt: at(0), scheduleId: schedule.id, date: '2026-11-02', category: 'carrera' }] });
    // The other device moves the same block that day.
    await h.batch({ scheduleExceptions: [{ clientId: 'e2', updatedAt: at(1), scheduleId: schedule.id, date: '2026-11-02', category: 'carrera', startMinute: 1020, endMinute: 1105 }] });
    let rows = await h.prisma.scheduleException.findMany({ where: { userId: h.userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ category: 'carrera', startMinute: 1020, endMinute: 1105 });

    const snapshot = await h.pull();
    expect(snapshot.scheduleExceptions).toHaveLength(1);

    await h.batch({ scheduleExceptions: [{ clientId: 'e1', updatedAt: at(2), scheduleId: schedule.id, date: '2026-11-02', deleted: true }] });
    rows = await h.prisma.scheduleException.findMany({ where: { userId: h.userId } });
    expect(rows).toHaveLength(0);
  });

  it('keeps one study plan per user, newest wins', async () => {
    await h.batch({ studyPlan: [{ updatedAt: at(1), planData: { startDate: '2026-10-19', weeks: 14 } }] });
    await h.batch({ studyPlan: [{ updatedAt: at(0), planData: { startDate: '2026-10-26', weeks: 14 } }] });
    const snapshot = await h.pull();
    expect(snapshot.studyPlan?.planData).toEqual({ startDate: '2026-10-19', weeks: 14 });
  });
});

describe('exercise attempts (study-tutor-game phase 2)', () => {
  const h = useSyncHarness();
  const attempt = (id: string, minutes: number, extra: Record<string, unknown> = {}) => ({
    id,
    exerciseId: 'AN1#3#2',
    exerciseSource: 'nota',
    noteCode: 'AN1',
    section: '3',
    b: 0,
    r: 1,
    hints: 0,
    gradedBy: 'claude',
    occurredAt: at(minutes),
    ...extra,
  });

  it('stores an attempt once: a retry and a racing duplicate are skipped, never updates', async () => {
    const first = await h.batch({ exerciseAttempts: [attempt('ea-1', 0)] });
    const retry = await h.batch({ exerciseAttempts: [attempt('ea-1', 0, { r: 0 })] });
    const [raceA, raceB] = await Promise.all([
      h.batch({ exerciseAttempts: [attempt('ea-2', 5)] }),
      h.batch({ exerciseAttempts: [attempt('ea-2', 5)] }),
    ]);

    expect(first.applied.exerciseAttempts?.[0].status).toBe('applied');
    expect(retry.applied.exerciseAttempts?.[0].status).toBe('skipped');
    expect([raceA, raceB].map((x) => x.applied.exerciseAttempts?.[0].status).sort()).toEqual(['applied', 'skipped']);
    const rows = await h.prisma.exerciseAttempt.findMany({ where: { userId: h.userId }, orderBy: { id: 'asc' } });
    expect(rows.map((x) => [x.id, x.r])).toEqual([['ea-1', 1], ['ea-2', 1]]);
    // Other devices are told to re-pull.
    expect(h.notifications.some((n) => n.entities.includes('exerciseAttempts'))).toBe(true);
  });

  it('keeps a correction as a new row, even when it arrives before its original', async () => {
    const correction = await h.batch({
      exerciseAttempts: [attempt('ea-fix', 10, { r: 1, gradedBy: 'usuario', supersedes: 'ea-orig' })],
    });
    const original = await h.batch({ exerciseAttempts: [attempt('ea-orig', 0, { r: 0 })] });

    expect(correction.applied.exerciseAttempts?.[0].status).toBe('applied');
    expect(original.applied.exerciseAttempts?.[0].status).toBe('applied');
    const rows = await h.prisma.exerciseAttempt.findMany({ where: { userId: h.userId }, orderBy: { occurredAt: 'asc' } });
    expect(rows.map((x) => [x.id, x.r, x.supersedes])).toEqual([
      ['ea-orig', 0, null],
      ['ea-fix', 1, 'ea-orig'],
    ]);
  });

  it('pulls the whole history oldest first, without the long texts or other users', async () => {
    await h.batch({
      exerciseAttempts: [
        attempt('ea-new', 0, {
          exerciseId: 'AN1#gen-1',
          exerciseSource: 'generado',
          b: -0.4,
          r: 0.5,
          generatedStatement: 'Demuestra que $\sqrt3$ es irracional.',
          feedback: 'Bien, faltó justificar el paso de paridad.',
          minutes: 7,
          pomodoroSessionId: 'block-b1-2026-10-21',
        }),
        attempt('ea-old', -400 * 24 * 60),
      ],
    });
    await h.batch({ exerciseAttempts: [attempt('ea-other', 1)] }, h.otherUserId);

    const { exerciseAttempts } = await h.pull();
    expect(exerciseAttempts.map((x) => x.id)).toEqual(['ea-old', 'ea-new']);
    expect(exerciseAttempts[1]).not.toHaveProperty('generatedStatement');
    expect(exerciseAttempts[1]).not.toHaveProperty('feedback');
    expect(exerciseAttempts[1]).toMatchObject({ exerciseSource: 'generado', b: -0.4, r: 0.5, minutes: 7 });

    const full = await h.service.listExerciseAttempts(h.userId);
    expect(full.map((x) => x.id)).toEqual(['ea-old', 'ea-new']);
    expect(full[1]).toMatchObject({
      generatedStatement: 'Demuestra que $\sqrt3$ es irracional.',
      feedback: 'Bien, faltó justificar el paso de paridad.',
    });
    const recent = await h.service.listExerciseAttempts(h.userId, new Date(at(-60)));
    expect(recent.map((x) => x.id)).toEqual(['ea-new']);
  });

  it('rejects a grade other than 0, 0.5 or 1, a b out of range and an unknown grader', async () => {
    const check = (change: Record<string, unknown>) =>
      validate(plainToInstance(SyncBatchDto, { exerciseAttempts: [change] }), { whitelist: true, forbidNonWhitelisted: true });
    expect(await check(attempt('ok', 0, { r: 0.5, minutes: null, supersedes: null }))).toEqual([]);
    expect(JSON.stringify(await check(attempt('bad-r', 0, { r: 0.7 })))).toContain('"r"');
    expect(JSON.stringify(await check(attempt('bad-b', 0, { b: 7 })))).toContain('"b"');
    expect(JSON.stringify(await check(attempt('bad-hints', 0, { hints: -1 })))).toContain('hints');
    expect(JSON.stringify(await check(attempt('bad-grader', 0, { gradedBy: 'gemini' })))).toContain('gradedBy');
    expect(JSON.stringify(await check(attempt('long', 0, { feedback: 'x'.repeat(10_001) })))).toContain('feedback');
  });
});
