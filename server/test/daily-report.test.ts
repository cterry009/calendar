import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { SyncEventsService } from '../src/realtime/sync-events.service';
import type { PlanningService } from '../src/planning/planning.service';
import type { PlanProposal } from '../src/planning/planning.types';
import { DailyReportService, fromLocal } from '../src/daily-report/daily-report.service';
import type { MailMessage } from '../src/daily-report/mailer';
import { testDatabaseUrl } from './test-db';

// The daily email and its plan suggestion (daily-email-report), on the test database with a recorded
// mailer and a canned planner. Bogotá has no DST, so local times are UTC-5.
describe('daily report', () => {
  const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
  const tz = 'America/Bogota';
  const sent: MailMessage[] = [];
  const notified: string[][] = [];
  let proposeCalls = 0;
  let proposal: PlanProposal;
  let userId = '';
  let blockId = '';
  let taskId = '';
  let service: DailyReportService;

  /** Local Bogotá time on Thursday 29 Oct 2026. */
  const local = (h: number, m = 0, day = 29) => new Date(Date.UTC(2026, 9, day, h + 5, m));

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "users" CASCADE');
    sent.length = 0;
    notified.length = 0;
    proposeCalls = 0;
    userId = (await prisma.user.create({ data: { email: 'Owner@local.test' } })).id;
    await prisma.user.create({ data: { email: 'someone-else@local.test' } });
    const now = new Date();
    blockId = (
      await prisma.schedule.create({
        data: { userId, kind: 'WORK', label: 'Estudio B1', daysOfWeek: [1, 2, 3, 4, 5], startMinute: 540, endMinute: 630, flexibleBlocks: 1, updatedAt: now },
      })
    ).id;
    taskId = (
      await prisma.task.create({
        data: { userId, title: 'AN1 · Darboux', estimatedMinutes: 60, difficulty: 'MEDIUM', priority: 'MEDIUM', updatedAt: now },
      })
    ).id;
    await prisma.task.create({
      data: { userId, title: 'Hecha hoy', estimatedMinutes: 30, difficulty: 'EASY', priority: 'LOW', status: 'COMPLETED', completedAt: local(10), updatedAt: now },
    });
    await prisma.pomodoroSession.create({
      data: {
        userId, state: 'IDLE', focusDurationMin: 30, shortBreakMin: 5, longBreakMin: 15, cyclesBeforeLongBreak: 4,
        completedCycles: 2, active: false, scheduleId: blockId, flexible: true, focusMinutes: 55,
        blockStartAt: local(9, 10), startedAt: local(9, 10), updatedAt: now,
      },
    });
    proposal = {
      planner: 'heurístico', complexitySource: 'stored', warnings: [], days: ['2026-10-30'],
      accepted: [{ taskId, date: '2026-10-30', scheduleId: blockId, priority: 'HIGH', reason: 'sigue la línea B1', startMinute: 540, complexity: 5 }],
      rejected: [], blocks: [], unplaced: [],
    };
    service = new DailyReportService(
      prisma as unknown as PrismaService,
      { propose: async () => { proposeCalls++; return proposal; } } as unknown as PlanningService,
      { notifyUser: (_u: string, p: { entities: string[] }) => notified.push(p.entities) } as unknown as SyncEventsService,
      { send: async (m) => { sent.push(m); } },
      { email: 'owner@local.test', sendMinute: 21 * 60, timeZone: tz, checkEveryMs: 60_000 },
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('sends the day at 21:00 once, with a plan for an empty tomorrow', async () => {
    await service.tick(local(20, 59));
    // Before 21:00 it's yesterday's catch-up, not today's.
    expect(sent.map((m) => m.subject)).toEqual([expect.stringContaining('miércoles 28 de octubre')]);
    await service.tick(local(21, 0));
    await service.tick(local(21, 5));
    expect(sent).toHaveLength(2);
    const today = sent[1];
    expect(today.to).toBe('Owner@local.test');
    expect(today.subject).toBe('Tu día: jueves 29 de octubre · 55 min de foco · plan por aprobar');
    expect(today.text).toContain('✔ 09:10 Estudio B1: 55 min de foco, 2 pomodoros');
    expect(today.text).toContain('✔ Hecha hoy');
    expect(today.text).toContain('MAÑANA, VIERNES 30 DE OCTUBRE');
    expect(today.text).toContain('· AN1 · Darboux (sigue la línea B1)');
    expect(await prisma.planSuggestion.count({ where: { userId, date: '2026-10-30', status: 'PENDING' } })).toBe(1);
    expect(await prisma.dailyReport.count({ where: { userId } })).toBe(2);
  });

  it('approves the suggestion into the calendar, leaving tasks planned meanwhile alone', async () => {
    await service.send(userId, 'owner@local.test', '2026-10-29');
    const pending = await service.pending(userId);
    expect(pending?.blocks).toEqual([
      { label: 'Estudio B1', start: '09:00', end: '10:30', tasks: [{ title: 'AN1 · Darboux', reason: 'sigue la línea B1' }] },
    ]);
    const result = await service.approve(userId, pending!.id);
    expect(result).toEqual({ scheduled: 1, skipped: 0 });
    const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
    expect(task.scheduledAt?.toISOString()).toBe('2026-10-30T14:00:00.000Z');
    expect(task.priority).toBe('HIGH');
    expect(notified).toEqual([['tasks']]);
    expect(await service.pending(userId)).toBeNull();
    // Approving again finds the task already planned.
    expect(await service.approve(userId, pending!.id)).toEqual({ scheduled: 0, skipped: 1 });
  });

  it('shows what is already planned and asks the planner nothing', async () => {
    await prisma.task.update({ where: { id: taskId }, data: { scheduledAt: fromLocal('2026-10-30', 540, tz) } });
    const preview = await service.preview(userId, '2026-10-29');
    expect(preview.text).toContain('09:00 · AN1 · Darboux');
    expect(preview.subject).not.toContain('plan por aprobar');
    expect(proposeCalls).toBe(0);
  });

  it('dismisses, and never mails anyone but the configured account', async () => {
    await service.send(userId, 'owner@local.test', '2026-10-29');
    const pending = await service.pending(userId);
    await service.dismiss(userId, pending!.id);
    expect(await service.pending(userId)).toBeNull();
    const other = await prisma.user.findFirstOrThrow({ where: { email: 'someone-else@local.test' } });
    await expect(service.dismiss(other.id, pending!.id)).rejects.toThrow('no encontrado');
    await service.tick(local(21, 30));
    expect(sent.every((m) => m.to.toLowerCase() === 'owner@local.test')).toBe(true);
  });

  it('rebuilds a pending suggestion when the email goes out, but keeps it for a preview', async () => {
    await service.preview(userId, '2026-10-29');
    await service.preview(userId, '2026-10-29');
    expect(proposeCalls).toBe(1);
    proposal = { ...proposal, accepted: [{ ...proposal.accepted[0], reason: 'nueva razón' }] };
    await service.send(userId, 'owner@local.test', '2026-10-29');
    expect(proposeCalls).toBe(2);
    expect((await service.pending(userId))?.blocks[0].tasks[0].reason).toBe('nueva razón');
  });
});
