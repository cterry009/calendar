import { Inject, Injectable, Logger, NotFoundException, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { isKnownDistractingApp } from '@calendar/shared';
import { DAILY_REPORT_CONFIG, fromLocal, type DailyReportConfig } from '../daily-report/daily-report.service';
import { MAILER, type Mailer } from '../daily-report/mailer';
import { dateRange, dayOfWeek, toLocal } from '../planning/slots';
import { PrismaService } from '../prisma/prisma.service';
import { buildPresentation } from './presentation';
import {
  hhmm,
  WEEKDAY_SHORT,
  weekCsv,
  weekHighlights,
  weekTotals,
  type DayRow,
  type NamedMinutes,
  type WeekData,
  type WeekTotals,
} from './week';
import { buildWeeklyEmail } from './weekly-email';

// The Sunday report (weekend-mode, user 2026-11-04): at 18:00 on Sunday the configured user gets the
// week, Monday to Sunday, compared with the one before. Same rules as the daily email: only
// DAILY_REPORT_EMAIL gets it, and a report missed while the PC was off goes out at the next start
// (last week's, never older). A manual send doesn't count as the scheduled one.

export interface WeeklyReportConfig {
  /** Minutes from local midnight on Sunday; 18:00 by default. */
  sendMinute: number;
}

export function weeklyReportConfig(env: NodeJS.ProcessEnv = process.env): WeeklyReportConfig {
  const [h, m] = (env.WEEKLY_REPORT_TIME ?? '18:00').split(':').map(Number);
  return { sendMinute: (Number.isFinite(h) ? h : 18) * 60 + (Number.isFinite(m) ? m : 0) };
}

export const WEEKLY_REPORT_CONFIG = Symbol('WEEKLY_REPORT_CONFIG');

const HISTORY_WEEKS = 4;
const LOL = /league of legends|wild rift|wildrift/i;

/** The Monday of a date's week (the week runs Monday to Sunday). */
export function mondayOf(date: string): string {
  const back = (dayOfWeek(date) + 6) % 7;
  return new Date(Date.parse(`${date}T00:00:00Z`) - back * 86_400_000).toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** "com.instagram.android" -> "instagram": the server only has package names. */
export function appName(packageName: string): string {
  const parts = packageName.split('.').filter((p) => !['com', 'org', 'net', 'app', 'android', 'google', 'apps', 'mobile'].includes(p));
  return parts[0] ?? packageName;
}

function addTo(map: Map<string, number>, key: string, value: number) {
  map.set(key, (map.get(key) ?? 0) + value);
}

function ranked(map: Map<string, number>): NamedMinutes[] {
  return [...map.entries()].map(([label, minutes]) => ({ label, minutes })).sort((a, b) => b.minutes - a.minutes);
}

function emptyDay(date: string): DayRow {
  return {
    date,
    weekday: WEEKDAY_SHORT[(dayOfWeek(date) + 6) % 7],
    focusMinutes: 0,
    pomodoros: 0,
    blocksPlanned: 0,
    blocksStarted: 0,
    blocksDone: 0,
    blocksSkipped: 0,
    tasksCompleted: 0,
    tasksLeftover: 0,
    exerciseAttempts: 0,
    exerciseCorrect: 0,
    phoneMinutes: null,
    phoneSocialMinutes: null,
    pcMinutes: null,
    gameMinutes: null,
    lolMinutes: null,
    blockAttempts: 0,
    nightBlockAttempts: 0,
    firstUseMinute: null,
    unlockMinute: null,
    exercisedOnWake: false,
    steps: null,
    floors: null,
    workoutMinutes: 0,
    habitsDone: 0,
    habitsPlanned: 0,
    weekendActivitiesDone: 0,
    weekendActivitiesPlanned: 0,
  };
}

@Injectable()
export class WeeklyReportService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WeeklyReportService.name);
  private timer: NodeJS.Timeout | null = null;
  private first: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MAILER) private readonly mailer: Mailer | null,
    @Inject(DAILY_REPORT_CONFIG) private readonly daily: DailyReportConfig,
    @Inject(WEEKLY_REPORT_CONFIG) private readonly config: WeeklyReportConfig,
  ) {}

  onModuleInit() {
    if (!this.daily.email || !this.mailer) return;
    this.first = setTimeout(() => void this.tick(), 30_000);
    this.timer = setInterval(() => void this.tick(), this.daily.checkEveryMs);
  }

  onModuleDestroy() {
    if (this.first) clearTimeout(this.first);
    if (this.timer) clearInterval(this.timer);
  }

  /** The week whose report is due at `now`: this one from Sunday's send time, else the last one. */
  dueWeek(now: Date): string {
    const local = toLocal(now, this.daily.timeZone);
    const monday = mondayOf(local.date);
    const sundayEvening = dayOfWeek(local.date) === 0 && local.minute >= this.config.sendMinute;
    return sundayEvening ? monday : addDays(monday, -7);
  }

  async tick(now = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const user = await this.prisma.user.findFirst({
        where: { email: { equals: this.daily.email!, mode: 'insensitive' } },
        select: { id: true, email: true },
      });
      if (!user) return;
      const weekStart = this.dueWeek(now);
      const sent = await this.prisma.weeklyReport.findUnique({
        where: { userId_weekStart: { userId: user.id, weekStart } },
      });
      if (sent?.sentAt) return;
      await this.send(user.id, user.email, weekStart, { now });
    } catch (error) {
      this.logger.warn(`No se pudo enviar el reporte semanal: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  /** Builds and sends a week. `record: false` (POST /weekly-report/send) doesn't mark it as sent. */
  async send(
    userId: string,
    to: string,
    weekStart: string,
    { record = true, now = new Date() }: { record?: boolean; now?: Date } = {},
  ): Promise<{ subject: string }> {
    if (!this.mailer) throw new Error('Falta DAILY_REPORT_SMTP_USER / DAILY_REPORT_SMTP_PASSWORD en el servidor.');
    const data = await this.build(userId, weekStart, now);
    const email = buildWeeklyEmail(data);
    await this.mailer.send({
      to,
      ...email,
      attachments: [
        { filename: `semana-${weekStart}.html`, content: buildPresentation(data), contentType: 'text/html; charset=utf-8' },
        { filename: `semana-${weekStart}.csv`, content: weekCsv(data), contentType: 'text/csv; charset=utf-8' },
        { filename: `semana-${weekStart}.json`, content: JSON.stringify(data, null, 2), contentType: 'application/json' },
      ],
    });
    if (record) {
      await this.prisma.weeklyReport.update({
        where: { userId_weekStart: { userId, weekStart } },
        data: { sentAt: new Date() },
      });
    }
    this.logger.log(`Reporte semanal del ${weekStart} enviado a ${to}.`);
    return { subject: email.subject };
  }

  /** Gathers the week and stores it, so the app lists it and later weeks compare against it. */
  async build(userId: string, weekStart: string, now = new Date()): Promise<WeekData> {
    const data = await this.gather(userId, weekStart, now);
    const json = data as unknown as Prisma.InputJsonValue;
    await this.prisma.weeklyReport.upsert({
      where: { userId_weekStart: { userId, weekStart } },
      create: { userId, weekStart, data: json },
      update: { data: json },
    });
    return data;
  }

  async list(userId: string) {
    const rows = await this.prisma.weeklyReport.findMany({
      where: { userId },
      orderBy: { weekStart: 'desc' },
      take: 60,
      select: { weekStart: true, sentAt: true },
    });
    return rows.map((r) => ({ weekStart: r.weekStart, sentAt: r.sentAt?.toISOString() ?? null }));
  }

  /** A stored week; the current or a missing one is built now. */
  async get(userId: string, weekStart: string): Promise<WeekData> {
    const row = await this.prisma.weeklyReport.findUnique({ where: { userId_weekStart: { userId, weekStart } } });
    if (row?.sentAt) return row.data as unknown as WeekData;
    if (weekStart > mondayOf(this.today())) throw new NotFoundException('Esa semana todavía no empieza.');
    return this.build(userId, weekStart);
  }

  presentation(data: WeekData): string {
    return buildPresentation(data);
  }

  csv(data: WeekData): string {
    return weekCsv(data);
  }

  today(now = new Date()): string {
    return toLocal(now, this.daily.timeZone).date;
  }

  /** Just the rows of a week. Also used for the week before, so it never recurses into history. */
  private async days(userId: string, weekStart: string) {
    const tz = this.daily.timeZone;
    const dates = dateRange(weekStart, 7);
    const start = fromLocal(dates[0], 0, tz);
    const end = fromLocal(addDays(dates[6], 1), 0, tz);
    const dayStart = new Date(`${dates[0]}T00:00:00Z`);
    const dayEnd = new Date(`${addDays(dates[6], 1)}T00:00:00Z`);
    const byDay = { gte: dayStart, lt: dayEnd };
    const inWeek = { gte: start, lt: end };

    const [schedules, sessions, completions, completed, leftover, attempts, screen, pc, games, events, steps, floors, fitness, habits, records] =
      await Promise.all([
        this.prisma.schedule.findMany({ where: { userId, kind: 'WORK' } }),
        this.prisma.pomodoroSession.findMany({
          where: {
            userId,
            OR: [{ blockStartAt: inWeek }, { blockStartAt: null, startedAt: inWeek }],
          },
        }),
        this.prisma.scheduleCompletion.findMany({ where: { userId, date: byDay, status: 'SKIPPED' } }),
        this.prisma.task.findMany({
          where: { userId, deletedAt: null, status: 'COMPLETED', completedAt: inWeek },
          select: { completedAt: true },
        }),
        this.prisma.task.findMany({
          where: { userId, deletedAt: null, status: { in: ['PENDING', 'IN_PROGRESS'] }, scheduledAt: inWeek },
          select: { scheduledAt: true },
        }),
        this.prisma.exerciseAttempt.findMany({
          where: { userId, occurredAt: inWeek },
          select: { id: true, supersedes: true, noteCode: true, section: true, r: true, occurredAt: true },
        }),
        this.prisma.dailyScreenTime.findMany({ where: { userId, date: byDay } }),
        this.prisma.dailyDesktopAppTime.findMany({ where: { userId, date: byDay } }),
        this.prisma.dailyGameTime.findMany({ where: { userId, date: byDay } }),
        this.prisma.blockEvent.findMany({ where: { userId, occurredAt: inWeek } }),
        this.prisma.dailyStepCount.findMany({ where: { userId, date: byDay } }),
        this.prisma.dailyFloorsClimbed.findMany({ where: { userId, date: byDay } }),
        this.prisma.fitnessEntry.findMany({ where: { userId, loggedAt: inWeek } }),
        this.prisma.habit.findMany({ where: { userId, deletedAt: null, archived: false } }),
        this.prisma.habitRecord.findMany({ where: { userId, date: byDay, status: 'DONE' } }),
      ]);

    const rows = new Map(dates.map((date) => [date, emptyDay(date)]));
    const row = (date: string) => rows.get(date);
    const localDay = (at: Date) => row(toLocal(at, tz).date);
    const keyOf = (date: Date) => date.toISOString().slice(0, 10);

    // The schedule of each day: a flexible window holds several blocks.
    for (const date of dates) {
      const weekday = dayOfWeek(date);
      row(date)!.blocksPlanned = schedules
        .filter((s) => s.enabled && s.daysOfWeek.includes(weekday))
        .reduce((total, s) => total + (s.flexibleBlocks ?? 1), 0);
    }

    const schedule = new Map(schedules.map((s) => [s.id, s]));
    const focusByCategory = new Map<string, number>();
    const missed = new Map<string, number>();
    for (const session of sessions) {
      const at = session.blockStartAt ?? session.startedAt;
      const day = at ? localDay(at) : undefined;
      if (!day) continue;
      const minutes = session.flexible ? session.focusMinutes : session.completedCycles * session.focusDurationMin;
      day.focusMinutes += minutes;
      day.pomodoros += session.completedCycles;
      const block = session.scheduleId ? schedule.get(session.scheduleId) : undefined;
      if (minutes > 0) addTo(focusByCategory, block?.category ?? block?.label ?? 'Sin bloque', minutes);
      if (!session.scheduleId) continue;
      day.blocksStarted += 1;
      if (session.flexible ? minutes >= 45 : session.completedCycles > 0) day.blocksDone += 1;
      else addTo(missed, block?.label ?? 'Bloque', 1);
    }
    for (const skipped of completions) {
      const day = row(keyOf(skipped.date));
      if (!day) continue;
      day.blocksSkipped += 1;
      addTo(missed, schedule.get(skipped.scheduleId)?.label ?? 'Bloque', 1);
    }

    for (const task of completed) if (task.completedAt) { const d = localDay(task.completedAt); if (d) d.tasksCompleted += 1; }
    for (const task of leftover) if (task.scheduledAt) { const d = localDay(task.scheduledAt); if (d) d.tasksLeftover += 1; }

    // Only the last grade of a corrected attempt counts (study-tutor-game D2).
    const superseded = new Set(attempts.map((a) => a.supersedes).filter(Boolean));
    const sectionStats = new Map<string, { attempts: number; sum: number }>();
    for (const attempt of attempts) {
      if (superseded.has(attempt.id)) continue;
      const day = localDay(attempt.occurredAt);
      if (!day) continue;
      day.exerciseAttempts += 1;
      if (attempt.r === 1) day.exerciseCorrect += 1;
      const key = `${attempt.noteCode} §${attempt.section}`;
      const stats = sectionStats.get(key) ?? { attempts: 0, sum: 0 };
      stats.attempts += 1;
      stats.sum += attempt.r;
      sectionStats.set(key, stats);
    }

    const phoneApps = new Map<string, number>();
    for (const rowScreen of screen) {
      const day = row(keyOf(rowScreen.date));
      if (!day) continue;
      const top = (rowScreen.topApps ?? []) as Array<{ packageName: string; minutes: number }>;
      day.phoneMinutes = rowScreen.totalMinutes;
      day.phoneSocialMinutes = top.filter((a) => isKnownDistractingApp(a.packageName)).reduce((s, a) => s + a.minutes, 0);
      for (const app of top) {
        addTo(phoneApps, appName(app.packageName), app.minutes);
        if (LOL.test(app.packageName)) day.lolMinutes = (day.lolMinutes ?? 0) + app.minutes;
      }
    }

    const pcApps = new Map<string, number>();
    for (const rowPc of pc) {
      const day = row(keyOf(rowPc.date));
      if (!day) continue;
      day.pcMinutes = rowPc.totalMinutes;
      for (const app of (rowPc.topApps ?? []) as Array<{ label: string; minutes: number }>) addTo(pcApps, app.label, app.minutes);
    }

    const gameTotals = new Map<string, number>();
    for (const rowGame of games) {
      const day = row(keyOf(rowGame.date));
      if (!day) continue;
      day.gameMinutes = rowGame.totalMinutes;
      for (const game of (rowGame.topGames ?? []) as Array<{ label: string; minutes: number }>) {
        addTo(gameTotals, game.label, game.minutes);
        if (LOL.test(game.label)) day.lolMinutes = (day.lolMinutes ?? 0) + game.minutes;
      }
    }

    const targets = new Map<string, number>();
    const blockHeatmap = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
    for (const event of events) {
      const local = toLocal(event.occurredAt, tz);
      const day = row(local.date);
      if (!day) continue;
      if (event.trigger === 'BLOCKED_OPEN_ATTEMPT') {
        day.blockAttempts += 1;
        if (event.scope === 'NIGHT') day.nightBlockAttempts += 1;
        blockHeatmap[(dayOfWeek(local.date) + 6) % 7][Math.floor(local.minute / 60)] += 1;
        if (event.identifier) addTo(targets, event.identifier.includes('.') && !event.identifier.endsWith('.exe') ? appOrSite(event.identifier) : event.identifier, 1);
      } else if (event.trigger === 'MORNING_FIRST_USE') {
        day.firstUseMinute = day.firstUseMinute === null ? local.minute : Math.min(day.firstUseMinute, local.minute);
      } else if (event.trigger === 'NIGHT_UNLOCK') {
        day.unlockMinute = day.unlockMinute === null ? local.minute : Math.min(day.unlockMinute, local.minute);
      } else if (event.trigger === 'MORNING_EXERCISE_YES') {
        day.exercisedOnWake = true;
      }
    }

    for (const s of steps) { const d = row(keyOf(s.date)); if (d) d.steps = s.steps; }
    for (const f of floors) { const d = row(keyOf(f.date)); if (d) d.floors = f.floors; }
    for (const entry of fitness) { const d = localDay(entry.loggedAt); if (d) d.workoutMinutes += entry.durationMinutes; }

    const doneOn = new Set(records.map((r) => `${r.habitId}|${keyOf(r.date)}`));
    const habitRows: WeekData['habits'] = [];
    const weekendActivities: WeekData['weekendActivities'] = [];
    for (const habit of habits) {
      const planned = dates.filter((date) => habit.reminderDaysOfWeek.includes(dayOfWeek(date)));
      let done = 0;
      for (const date of planned) {
        const day = row(date)!;
        const did = doneOn.has(`${habit.id}|${date}`);
        if (did) done += 1;
        if (habit.kind === 'WEEKEND_ACTIVITY') {
          day.weekendActivitiesPlanned += 1;
          if (did) day.weekendActivitiesDone += 1;
          weekendActivities.push({
            title: habit.title,
            day: dayOfWeek(date) === 6 ? 'Sábado' : 'Domingo',
            time: habit.reminderEndMinute === null ? null : hhmm(habit.reminderEndMinute),
            done: did,
          });
        } else {
          day.habitsPlanned += 1;
          if (did) day.habitsDone += 1;
        }
      }
      if (habit.kind === 'HABIT') habitRows.push({ title: habit.title, done, planned: planned.length });
    }

    const days = dates.map((date) => row(date)!);
    return {
      days,
      focusByCategory: ranked(focusByCategory),
      missedBlocks: ranked(missed).map((m) => ({ label: m.label, count: m.minutes })),
      topPhoneApps: ranked(phoneApps),
      topPcApps: ranked(pcApps),
      topGames: ranked(gameTotals),
      blockedTargets: ranked(targets).map((t) => ({ label: t.label, count: t.minutes })),
      blockHeatmap,
      habits: habitRows.sort((a, b) => b.done / (b.planned || 1) - a.done / (a.planned || 1)),
      weekendActivities: weekendActivities.sort((a, b) => (a.day === b.day ? (a.time ?? '').localeCompare(b.time ?? '') : a.day === 'Sábado' ? -1 : 1)),
      study: {
        sections: [...sectionStats.entries()].map(([key, s]) => ({ key, attempts: s.attempts, meanGrade: s.sum / s.attempts })),
      },
    };
  }

  /** The stored totals of the weeks before; one that was never built is computed. */
  private async totalsOf(userId: string, weekStart: string): Promise<WeekTotals | null> {
    const stored = await this.prisma.weeklyReport.findUnique({ where: { userId_weekStart: { userId, weekStart } } });
    if (stored?.sentAt) return (stored.data as unknown as WeekData).totals;
    const { days } = await this.days(userId, weekStart);
    const totals = weekTotals(days);
    // A week with nothing at all isn't a week to compare with.
    const empty = totals.focusMinutes === 0 && totals.steps === 0 && totals.phoneMinutes === 0 && totals.pcMinutes === 0;
    return empty ? null : totals;
  }

  async gather(userId: string, weekStart: string, now = new Date()): Promise<WeekData> {
    const rows = await this.days(userId, weekStart);
    const totals = weekTotals(rows.days);
    const history: WeekData['history'] = [];
    for (let back = HISTORY_WEEKS; back >= 1; back--) {
      const start = addDays(weekStart, -7 * back);
      const week = await this.totalsOf(userId, start);
      if (week) history.push({ weekStart: start, totals: week });
    }
    const lastWeek = addDays(weekStart, -7);
    const previous = history.find((h) => h.weekStart === lastWeek)?.totals ?? null;
    return {
      ...rows,
      weekStart,
      weekEnd: addDays(weekStart, 6),
      generatedAt: now.toISOString(),
      timeZone: this.daily.timeZone,
      totals,
      previous,
      history,
      highlights: weekHighlights({ days: rows.days, totals, previous }),
    };
  }
}

/** A block event's identifier: a package ("com.discord") or a domain ("discord.com"). */
function appOrSite(identifier: string): string {
  return /^(com|org|net|app|io)\./.test(identifier) ? appName(identifier) : identifier;
}
