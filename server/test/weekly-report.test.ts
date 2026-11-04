import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { DailyReportConfig } from '../src/daily-report/daily-report.service';
import type { MailMessage } from '../src/daily-report/mailer';
import type { PrismaService } from '../src/prisma/prisma.service';
import { buildPresentation } from '../src/weekly-report/presentation';
import { weekCsv, weekHighlights, weekTotals, type DayRow } from '../src/weekly-report/week';
import { appName, mondayOf, WeeklyReportService } from '../src/weekly-report/weekly-report.service';
import { testDatabaseUrl } from './test-db';

// The Sunday report (weekend-mode) on the test database with a recorded mailer. Bogotá has no DST:
// local times are UTC-5. 2026-11-02 is a Monday, 11-08 its Sunday.
describe('weekly report', () => {
  const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
  const sent: MailMessage[] = [];
  const config: DailyReportConfig = { email: 'owner@local.test', sendMinute: 21 * 60, timeZone: 'America/Bogota', checkEveryMs: 60_000 };
  const mailer = { send: async (m: MailMessage) => void sent.push(m) };
  const service = new WeeklyReportService(prisma as unknown as PrismaService, mailer, config, { sendMinute: 18 * 60 });
  const local = (day: number, h: number, m = 0) => new Date(Date.UTC(2026, 10, day, h + 5, m));
  const dayKey = (day: number) => new Date(Date.UTC(2026, 10, day));
  let userId = '';
  let otherId = '';

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "users" CASCADE');
    sent.length = 0;
    userId = (await prisma.user.create({ data: { email: 'Owner@local.test' } })).id;
    otherId = (await prisma.user.create({ data: { email: 'other@local.test' } })).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('knows the Monday of a date', () => {
    expect(mondayOf('2026-11-02')).toBe('2026-11-02');
    expect(mondayOf('2026-11-08')).toBe('2026-11-02');
    expect(mondayOf('2026-11-09')).toBe('2026-11-09');
  });

  it('names packages by their useful part', () => {
    expect(appName('com.instagram.android')).toBe('instagram');
    expect(appName('com.zhiliaoapp.musically')).toBe('zhiliaoapp');
  });

  it('adds up the week, only of this user, in local days', async () => {
    const schedule = await prisma.schedule.create({
      data: { userId, kind: 'WORK', label: 'Estudio B1', category: 'estudio_b1', daysOfWeek: [1, 2, 3, 4, 5], startMinute: 540, endMinute: 720, flexibleBlocks: 2 },
    });
    await prisma.pomodoroSession.createMany({
      data: [
        { userId, scheduleId: schedule.id, flexible: true, focusMinutes: 60, completedCycles: 2, blockStartAt: local(2, 9) },
        { userId, scheduleId: schedule.id, flexible: true, focusMinutes: 20, completedCycles: 1, blockStartAt: local(3, 9) },
        // Saturday 23:30 local is Sunday in UTC: it still belongs to Saturday.
        { userId, focusDurationMin: 25, completedCycles: 2, startedAt: local(7, 23, 30) },
        { userId: otherId, scheduleId: null, flexible: true, focusMinutes: 500, completedCycles: 9, startedAt: local(2, 9) },
      ],
    });
    await prisma.scheduleCompletion.create({ data: { userId, scheduleId: schedule.id, date: dayKey(4), status: 'SKIPPED' } });
    await prisma.dailyGameTime.create({
      data: {
        userId,
        date: dayKey(3),
        totalMinutes: 120,
        topGames: [
          { key: 'a', label: 'League of Legends', minutes: 90, source: 'RIOT' },
          { key: 'b', label: 'Hades', minutes: 30, source: 'STEAM' },
        ],
      },
    });
    await prisma.dailyScreenTime.create({
      data: {
        userId,
        date: dayKey(3),
        totalMinutes: 200,
        topApps: [
          { packageName: 'com.instagram.android', minutes: 100 },
          { packageName: 'com.whatsapp', minutes: 40 },
        ],
      },
    });
    await prisma.blockEvent.createMany({
      data: [
        { id: 'e1', userId, identifier: 'com.discord', scope: 'NIGHT', trigger: 'BLOCKED_OPEN_ATTEMPT', occurredAt: local(4, 23) },
        { id: 'e2', userId, scope: 'NIGHT', trigger: 'MORNING_FIRST_USE', occurredAt: local(5, 8, 10) },
        { id: 'e3', userId, scope: 'NIGHT', trigger: 'NIGHT_UNLOCK', occurredAt: local(5, 8, 40) },
        { id: 'e4', userId, scope: 'NIGHT', trigger: 'MORNING_EXERCISE_YES', occurredAt: local(5, 8, 11) },
      ],
    });
    await prisma.dailyStepCount.create({ data: { userId, date: dayKey(5), steps: 8000 } });
    const habit = await prisma.habit.create({ data: { userId, title: 'Leer', reminderDaysOfWeek: [1, 2] } });
    const weekend = await prisma.habit.create({
      data: { userId, title: 'Lavar ropa', kind: 'WEEKEND_ACTIVITY', reminderEndMinute: 600, reminderDaysOfWeek: [6] },
    });
    await prisma.habitRecord.createMany({
      data: [
        { userId, habitId: habit.id, date: dayKey(2), value: 1 },
        { userId, habitId: weekend.id, date: dayKey(7), value: 1 },
      ],
    });

    const week = await service.gather(userId, '2026-11-02', local(8, 18));

    expect(week.weekEnd).toBe('2026-11-08');
    expect(week.days.map((d) => d.weekday)).toEqual(['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']);
    expect(week.days[0]).toMatchObject({ focusMinutes: 60, blocksPlanned: 2, blocksStarted: 1, blocksDone: 1, habitsDone: 1 });
    expect(week.days[1]).toMatchObject({ focusMinutes: 20, blocksDone: 0, lolMinutes: 90, gameMinutes: 120, phoneSocialMinutes: 100 });
    expect(week.days[2].blocksSkipped).toBe(1);
    expect(week.days[3]).toMatchObject({ firstUseMinute: 490, unlockMinute: 520, exercisedOnWake: true, steps: 8000 });
    expect(week.days[5]).toMatchObject({ focusMinutes: 50, weekendActivitiesDone: 1, weekendActivitiesPlanned: 1 });
    expect(week.totals).toMatchObject({ focusMinutes: 130, blocksPlanned: 10, blocksDone: 1, lolMinutes: 90 });
    expect(week.focusByCategory[0]).toEqual({ label: 'estudio_b1', minutes: 80 });
    expect(week.missedBlocks[0]).toEqual({ label: 'Estudio B1', count: 2 });
    expect(week.blockedTargets).toEqual([{ label: 'discord', count: 1 }]);
    expect(week.blockHeatmap[2][23]).toBe(1);
    expect(week.habits).toEqual([{ title: 'Leer', done: 1, planned: 2 }]);
    expect(week.weekendActivities).toEqual([{ title: 'Lavar ropa', day: 'Sábado', time: '10:00', done: true }]);
  });

  it('counts only the last grade of a corrected exercise', async () => {
    const attempt = { userId, exerciseId: 'x', exerciseSource: 'nota', noteCode: 'AN1', section: '3', b: 0, hints: 0, gradedBy: 'claude' } as const;
    await prisma.exerciseAttempt.createMany({
      data: [
        { ...attempt, id: 'a1', r: 0, occurredAt: local(2, 10) },
        { ...attempt, id: 'a2', r: 1, supersedes: 'a1', occurredAt: local(2, 10, 5) },
      ],
    });
    const week = await service.gather(userId, '2026-11-02');
    expect(week.totals).toMatchObject({ exerciseAttempts: 1, exerciseCorrect: 1 });
    expect(week.study.sections).toEqual([{ key: 'AN1 §3', attempts: 1, meanGrade: 1 }]);
  });

  it('sends on Sunday from 18:00, once, with the three attachments', async () => {
    await prisma.dailyStepCount.create({ data: { userId, date: dayKey(5), steps: 100 } });
    await prisma.weeklyReport.create({ data: { userId, weekStart: '2026-10-26', data: {}, sentAt: local(1, 18) } });

    await service.tick(local(8, 17, 55));
    expect(sent).toHaveLength(0);

    await service.tick(local(8, 18, 5));
    await service.tick(local(8, 18, 10));
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('Owner@local.test');
    expect(sent[0].attachments!.map((a) => a.filename)).toEqual(['semana-2026-11-02.html', 'semana-2026-11-02.csv', 'semana-2026-11-02.json']);
    expect(JSON.parse(sent[0].attachments![2].content).totals.steps).toBe(100);
  });

  it('catches up last week after a Sunday with the PC off, and only that one', async () => {
    await service.tick(local(10, 9));
    expect(sent).toHaveLength(1);
    expect(sent[0].attachments![1].filename).toBe('semana-2026-11-02.csv');
    await service.tick(local(10, 9, 5));
    expect(sent).toHaveLength(1);
  });

  it('a manual send does not stand in for the Sunday one', async () => {
    await service.send(userId, 'owner@local.test', '2026-11-02', { record: false });
    await service.tick(local(8, 18, 5));
    expect(sent).toHaveLength(2);
  });

  it('compares with the stored week before and keeps up to four weeks of history', async () => {
    await prisma.dailyStepCount.create({ data: { userId, date: dayKey(5), steps: 10000 } });
    await prisma.dailyStepCount.create({ data: { userId, date: new Date(Date.UTC(2026, 9, 29)), steps: 2000 } });
    const week = await service.gather(userId, '2026-11-02');
    expect(week.previous?.steps).toBe(2000);
    expect(week.history.map((h) => h.weekStart)).toEqual(['2026-10-26']);
    expect(week.highlights.join(' ')).toMatch(/mejoró: subió los pasos/i);
  });

  it('builds a presentation of ten slides and a CSV of seven rows, offline and escaped', async () => {
    await prisma.habit.create({
      data: { userId, title: '<b>Salir</b>', kind: 'WEEKEND_ACTIVITY', reminderEndMinute: 600, reminderDaysOfWeek: [6] },
    });
    const week = await service.gather(userId, '2026-11-02');
    const html = buildPresentation(week);
    expect(html.match(/<section class="slide"/g)).toHaveLength(10);
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).toContain('&lt;b&gt;Salir&lt;/b&gt;');
    expect(html).not.toContain('NaN');
    const lines = weekCsv(week).trim().split('\r\n');
    expect(lines).toHaveLength(8);
    expect(lines[0]).toContain('foco_min');
  });

  it('adds up nulls as zero and leaves a rate null with nothing planned', () => {
    const days = [{ focusMinutes: 10, steps: null, blocksPlanned: 0, firstUseMinute: null }] as unknown as DayRow[];
    const totals = weekTotals(days);
    expect(totals).toMatchObject({ focusMinutes: 10, steps: 0, scheduleRate: null, avgFirstUseMinute: null });
    expect(weekHighlights({ days, totals, previous: null })[0]).toMatch(/10 min de foco/);
  });
});
