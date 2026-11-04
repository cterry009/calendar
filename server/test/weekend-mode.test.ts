import { describe, expect, it } from 'vitest';
import 'reflect-metadata';
import { CommitmentService } from '../src/commitment/commitment.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { SyncEventsService } from '../src/realtime/sync-events.service';
import { at, useSyncHarness } from './harness';

// weekend-mode (2026-11-04): per-app night starts, weekend activities and the block commitment,
// against the real sync rules.

const h = useSyncHarness();

function commitments() {
  const events = { notifyUser: () => undefined } as unknown as SyncEventsService;
  return new CommitmentService(h.prisma as unknown as PrismaService, events);
}

const lol = {
  updatedAt: at(0),
  kind: 'DESKTOP_APP',
  identifier: 'LeagueClient.exe|LeagueClientUx.exe|League of Legends.exe',
  label: 'League of Legends',
  platform: 'WINDOWS',
  scope: 'NIGHT',
  nightStartMinutes: 20 * 60,
  weekendNightStartMinutes: 22 * 60,
};

async function nightEntry() {
  await h.batch({ blockListEntries: [lol] } as never);
  return h.prisma.blockListEntry.findFirstOrThrow({ where: { userId: h.userId } });
}

describe('per-app night starts', () => {
  it('stores them, keeps them when an older client omits them, and clears them with null', async () => {
    const entry = await nightEntry();
    expect([entry.nightStartMinutes, entry.weekendNightStartMinutes]).toEqual([1200, 1320]);

    const { nightStartMinutes: _n, weekendNightStartMinutes: _w, ...older } = lol;
    await h.batch({ blockListEntries: [{ ...older, id: entry.id, updatedAt: at(1), label: 'LoL' }] } as never);
    let row = await h.prisma.blockListEntry.findUniqueOrThrow({ where: { id: entry.id } });
    expect([row.label, row.nightStartMinutes]).toEqual(['LoL', 1200]);

    await h.batch({ blockListEntries: [{ ...lol, id: entry.id, updatedAt: at(2), nightStartMinutes: null }] } as never);
    row = await h.prisma.blockListEntry.findUniqueOrThrow({ where: { id: entry.id } });
    expect(row.nightStartMinutes).toBeNull();
  });
});

describe('weekend activities', () => {
  const activity = (n: number, day = 6) => ({
    clientId: `act-${n}`,
    updatedAt: at(n),
    title: `Actividad ${n}`,
    kind: 'WEEKEND_ACTIVITY',
    reminderEndMinute: 600,
    reminderDaysOfWeek: [day],
  });

  it('takes three on Saturday and refuses a fourth, which another day still fits', async () => {
    await h.batch({ habits: [activity(1), activity(2), activity(3)] } as never);
    const result = await h.batch({ habits: [activity(4), activity(5, 0)] } as never);

    expect(result.conflicts.habits).toEqual([
      expect.objectContaining({ clientKey: 'act-4', reason: 'weekend-activity-cap', server: null }),
    ]);
    const kinds = await h.prisma.habit.findMany({ where: { userId: h.userId }, orderBy: { title: 'asc' } });
    expect(kinds.map((k) => [k.title, k.kind])).toEqual([
      ['Actividad 1', 'WEEKEND_ACTIVITY'],
      ['Actividad 2', 'WEEKEND_ACTIVITY'],
      ['Actividad 3', 'WEEKEND_ACTIVITY'],
      ['Actividad 5', 'WEEKEND_ACTIVITY'],
    ]);
  });

  it('keeps a habit a habit when an older client edits it', async () => {
    await h.batch({ habits: [activity(1)] } as never);
    const row = await h.prisma.habit.findFirstOrThrow({ where: { userId: h.userId } });
    await h.batch({ habits: [{ id: row.id, updatedAt: at(5), title: 'Renombrada', reminderDaysOfWeek: [6] }] } as never);
    expect((await h.prisma.habit.findUniqueOrThrow({ where: { id: row.id } })).kind).toBe('WEEKEND_ACTIVITY');
  });
});

describe('block commitment', () => {
  it('starts at 7 days, extends from its end, goes indefinite and never comes back from it', async () => {
    const service = commitments();
    const now = new Date('2026-11-04T12:00:00Z');
    const first = await service.extend(h.userId, {}, now);
    expect(first.endsAt).toBe('2026-11-11T12:00:00.000Z');
    const longer = await service.extend(h.userId, { days: 30 }, now);
    expect(longer.endsAt).toBe('2026-12-11T12:00:00.000Z');
    expect(longer.startedAt).toBe(first.startedAt);
    expect((await service.extend(h.userId, { indefinite: true }, now)).endsAt).toBeNull();
    expect((await service.extend(h.userId, { days: 7 }, now)).endsAt).toBeNull();
  });

  it('reaches the clients in the snapshot', async () => {
    expect((await h.pull()).commitment).toBeNull();
    await commitments().extend(h.userId, {});
    expect((await h.pull()).commitment).toMatchObject({ active: true });
  });

  it('refuses deleting, disabling or delaying a night entry while it lasts, and allows stricter', async () => {
    const entry = await nightEntry();
    await commitments().extend(h.userId, {});
    const change = { ...lol, id: entry.id };

    const refused = await h.batch({
      blockListEntries: [
        { ...change, updatedAt: at(1), deleted: true },
        { ...change, updatedAt: at(2), enabled: false },
        { ...change, updatedAt: at(3), nightStartMinutes: 21 * 60 },
        { ...change, updatedAt: at(4), weekendNightStartMinutes: 0 },
        { ...change, updatedAt: at(5), scope: 'FOCUS' },
      ],
    } as never);
    expect(refused.conflicts.blockListEntries).toHaveLength(5);
    expect(refused.conflicts.blockListEntries!.every((c) => c.reason === 'commitment')).toBe(true);

    const stricter = await h.batch({ blockListEntries: [{ ...change, updatedAt: at(6), nightStartMinutes: 19 * 60 }] } as never);
    expect(stricter.applied.blockListEntries).toHaveLength(1);
    expect((await h.prisma.blockListEntry.findUniqueOrThrow({ where: { id: entry.id } })).nightStartMinutes).toBe(1140);
  });

  it('refuses a later night window and allows an earlier one', async () => {
    const plan = (n: number, nightWindow: object) => ({ updatedAt: at(n), planData: { startDate: '2026-10-19', nightWindow } });
    await h.batch({ studyPlan: [plan(0, { startMinutes: 1320, endMinutes: 480, weekendStartMinutes: 0 })] } as never);
    await commitments().extend(h.userId, {});

    const later = await h.batch({ studyPlan: [plan(1, { startMinutes: 1380, endMinutes: 480, weekendStartMinutes: 0 })] } as never);
    expect(later.conflicts.studyPlan).toEqual([expect.objectContaining({ reason: 'commitment' })]);
    const shorter = await h.batch({ studyPlan: [plan(2, { startMinutes: 1320, endMinutes: 420, weekendStartMinutes: 0 })] } as never);
    expect(shorter.conflicts.studyPlan).toHaveLength(1);

    const earlier = await h.batch({ studyPlan: [plan(3, { startMinutes: 1290, endMinutes: 480, weekendStartMinutes: 1380 })] } as never);
    expect(earlier.applied.studyPlan).toHaveLength(1);
  });

  it('lets everything through once it has ended', async () => {
    const entry = await nightEntry();
    await h.prisma.blockCommitment.create({
      data: { userId: h.userId, startedAt: new Date('2026-01-01'), endsAt: new Date('2026-01-08') },
    });
    const result = await h.batch({ blockListEntries: [{ ...lol, id: entry.id, updatedAt: at(1), deleted: true }] } as never);
    expect(result.applied.blockListEntries).toHaveLength(1);
  });
});
