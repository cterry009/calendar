import { describe, expect, it } from 'vitest';
import { at, useSyncHarness } from './harness';

// SyncService owns every conflict rule in the project, and a bug there doesn't crash -- it
// quietly loses or resurrects a row. Each test pins one rule against a real Postgres (task 12.9).

const h = useSyncHarness();

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
