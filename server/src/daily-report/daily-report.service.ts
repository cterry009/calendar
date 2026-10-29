import { Inject, Injectable, Logger, NotFoundException, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { PlanSuggestion, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SyncEventsService } from '../realtime/sync-events.service';
import { PlanningService } from '../planning/planning.service';
import type { PlanProposal } from '../planning/planning.types';
import { dateRange, dayOfWeek, toLocal } from '../planning/slots';
import { buildReportEmail, type DayReportData, type ReportSuggestedBlock } from './report';
import { MAILER, type Mailer } from './mailer';

// The daily email (daily-email-report, user 2026-10-29): at 21:00 the configured user gets the day's
// report and the next day's plan; when the next day has nothing planned, the planner proposes one and
// it waits in the apps ("Plan sugerido") to be approved. The server runs on the user's PC, so a report
// missed while it was off goes out at the next start (yesterday's, before today's 21:00). Only
// DAILY_REPORT_EMAIL gets it -- the dev database has many test accounts.

export interface DailyReportConfig {
  email: string | null;
  /** Minutes from local midnight; 21:00 by default. */
  sendMinute: number;
  timeZone: string;
  checkEveryMs: number;
}

export function dailyReportConfig(env: NodeJS.ProcessEnv = process.env): DailyReportConfig {
  const [h, m] = (env.DAILY_REPORT_TIME ?? '21:00').split(':').map(Number);
  return {
    email: env.DAILY_REPORT_EMAIL?.trim().toLowerCase() || null,
    sendMinute: (Number.isFinite(h) ? h : 21) * 60 + (Number.isFinite(m) ? m : 0),
    timeZone: env.DAILY_REPORT_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone,
    checkEveryMs: Number(env.DAILY_REPORT_CHECK_MS) || 5 * 60_000,
  };
}

export const DAILY_REPORT_CONFIG = Symbol('DAILY_REPORT_CONFIG');

/** The instant a local date and minute is in a time zone (DST-safe: corrects by the zone's offset). */
export function fromLocal(date: string, minute: number, timeZone: string): Date {
  const wanted = Date.parse(`${date}T00:00:00Z`) + minute * 60_000;
  let guess = wanted;
  for (let i = 0; i < 3; i++) {
    const local = toLocal(new Date(guess), timeZone);
    const seen = Date.parse(`${local.date}T00:00:00Z`) + local.minute * 60_000;
    if (seen === wanted) break;
    guess += wanted - seen;
  }
  return new Date(guess);
}

function hhmm(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

/** What GET /planning/suggestions/pending answers: the proposal as blocks with their tasks. */
export interface PlanSuggestionView {
  id: string;
  date: string;
  status: string;
  planner: string;
  warnings: string[];
  blocks: ReportSuggestedBlock[];
  /** Tasks proposed for the day with no block ("whenever"). */
  loose: Array<{ title: string; reason: string }>;
}

interface StoredProposal extends PlanProposal {
  /** Titles at proposal time, so the view doesn't need the tasks (they may change). */
  titles: Record<string, string>;
  /** Block labels and times, by scheduleId. */
  slots: Record<string, { label: string; startMinute: number; endMinute: number }>;
}

@Injectable()
export class DailyReportService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DailyReportService.name);
  private timer: NodeJS.Timeout | null = null;
  private first: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly planning: PlanningService,
    private readonly syncEvents: SyncEventsService,
    @Inject(MAILER) private readonly mailer: Mailer | null,
    @Inject(DAILY_REPORT_CONFIG) private readonly config: DailyReportConfig,
  ) {}

  onModuleInit() {
    if (!this.config.email) return;
    if (!this.mailer) {
      this.logger.warn('DAILY_REPORT_EMAIL sin DAILY_REPORT_SMTP_USER/PASSWORD: el reporte diario no se envía.');
      return;
    }
    // A little after start (the catch-up), then every few minutes.
    this.first = setTimeout(() => void this.tick(), 20_000);
    this.timer = setInterval(() => void this.tick(), this.config.checkEveryMs);
  }

  onModuleDestroy() {
    if (this.first) clearTimeout(this.first);
    if (this.timer) clearInterval(this.timer);
  }

  /** Sends whatever report is due now: today's after the send time, else yesterday's if it was missed. */
  async tick(now = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const user = await this.prisma.user.findFirst({
        where: { email: { equals: this.config.email!, mode: 'insensitive' } },
        select: { id: true, email: true },
      });
      if (!user) return;
      const local = toLocal(now, this.config.timeZone);
      // Only one day back: a PC off for a week doesn't get a week of reports at once.
      const date = local.minute >= this.config.sendMinute ? local.date : previousDate(local.date);
      const sent = await this.prisma.dailyReport.findUnique({ where: { userId_date: { userId: user.id, date } } });
      if (sent) return;
      await this.send(user.id, user.email, date);
    } catch (error) {
      this.logger.warn(`No se pudo enviar el reporte diario: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  /**
   * Builds and sends the report for `date`, and records it as that day's. A manual send (POST
   * /daily-report/send) passes `record: false`: a test at noon must not stand in for the 21:00 one
   * (it did on 2026-10-29).
   */
  async send(userId: string, to: string, date: string, { record = true } = {}): Promise<{ subject: string }> {
    if (!this.mailer) throw new Error('Falta DAILY_REPORT_SMTP_USER / DAILY_REPORT_SMTP_PASSWORD en el servidor.');
    // The email is the moment of truth: a suggestion still pending is rebuilt with the day's tasks.
    const email = buildReportEmail(await this.gather(userId, date, true));
    await this.mailer.send({ to, ...email });
    if (record) await this.prisma.dailyReport.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date },
      update: { sentAt: new Date() },
    });
    this.logger.log(`Reporte diario del ${date} enviado a ${to}.`);
    return { subject: email.subject };
  }

  /** The report without sending it (POST /daily-report/send?dryRun=true). */
  async preview(userId: string, date: string) {
    return buildReportEmail(await this.gather(userId, date));
  }

  today(now = new Date()): string {
    return toLocal(now, this.config.timeZone).date;
  }

  async gather(userId: string, date: string, refresh = false): Promise<DayReportData> {
    const tz = this.config.timeZone;
    const nextDate = dateRange(date, 2)[1];
    const start = fromLocal(date, 0, tz);
    const end = fromLocal(nextDate, 0, tz);
    const dayKey = new Date(`${date}T00:00:00Z`);

    const [schedules, sessions, completed, leftover, skipped, steps, screen, games, habits, habitRecords] = await Promise.all([
      this.prisma.schedule.findMany({ where: { userId, kind: 'WORK' } }),
      this.prisma.pomodoroSession.findMany({
        where: {
          userId,
          scheduleId: { not: null },
          OR: [{ blockStartAt: { gte: start, lt: end } }, { blockStartAt: null, startedAt: { gte: start, lt: end } }],
        },
      }),
      this.prisma.task.findMany({
        where: { userId, deletedAt: null, status: 'COMPLETED', completedAt: { gte: start, lt: end } },
        select: { title: true },
        orderBy: { completedAt: 'asc' },
      }),
      this.prisma.task.findMany({
        where: { userId, deletedAt: null, status: { in: ['PENDING', 'IN_PROGRESS'] }, scheduledAt: { gte: start, lt: end } },
        select: { title: true },
      }),
      this.prisma.scheduleCompletion.findMany({ where: { userId, date: dayKey, status: 'SKIPPED' } }),
      this.prisma.dailyStepCount.findUnique({ where: { userId_date: { userId, date: dayKey } } }),
      this.prisma.dailyScreenTime.findUnique({ where: { userId_date: { userId, date: dayKey } } }),
      this.prisma.dailyGameTime.findUnique({ where: { userId_date: { userId, date: dayKey } } }),
      this.prisma.habit.count({ where: { userId, deletedAt: null, archived: false } }),
      this.prisma.habitRecord.count({ where: { userId, date: dayKey, status: 'DONE' } }),
    ]);
    const labelOf = new Map(schedules.map((s) => [s.id, s.label ?? 'Bloque']));

    const blocks = sessions
      .map((s) => {
        const at = s.blockStartAt ?? s.startedAt!;
        const focusMinutes = s.flexible ? s.focusMinutes : s.completedCycles * s.focusDurationMin;
        return {
          at: at.getTime(),
          label: labelOf.get(s.scheduleId!) ?? 'Bloque',
          start: hhmm(toLocal(at, tz).minute),
          focusMinutes,
          pomodoros: s.completedCycles,
          done: s.flexible ? focusMinutes >= 45 : s.completedCycles > 0,
        };
      })
      .sort((a, b) => a.at - b.at)
      .map(({ at: _at, ...b }) => b);

    return {
      date,
      nextDate,
      blocks,
      skipped: skipped.map((c) => labelOf.get(c.scheduleId) ?? 'Bloque'),
      completedTasks: completed.map((t) => t.title),
      leftover: leftover.map((t) => t.title),
      steps: steps?.steps ?? null,
      screenMinutes: screen?.totalMinutes ?? null,
      gameMinutes: games?.totalMinutes ?? null,
      habits: { done: habitRecords, total: habits },
      next: await this.nextDay(userId, nextDate, schedules, refresh),
    };
  }

  private async nextDay(
    userId: string,
    date: string,
    schedules: Array<{ id: string; label: string | null; enabled: boolean; daysOfWeek: number[]; startMinute: number; endMinute: number }>,
    refresh: boolean,
  ): Promise<DayReportData['next']> {
    const tz = this.config.timeZone;
    const weekday = dayOfWeek(date);
    const blocks = schedules
      .filter((s) => s.enabled && s.daysOfWeek.includes(weekday))
      .sort((a, b) => a.startMinute - b.startMinute)
      .map((s) => ({ label: s.label ?? 'Bloque', start: hhmm(s.startMinute), end: hhmm(s.endMinute) }));
    const start = fromLocal(date, 0, tz);
    const end = fromLocal(dateRange(date, 2)[1], 0, tz);
    const planned = await this.prisma.task.findMany({
      where: { userId, deletedAt: null, status: { in: ['PENDING', 'IN_PROGRESS'] }, scheduledAt: { gte: start, lt: end } },
      orderBy: { scheduledAt: 'asc' },
      select: { title: true, scheduledAt: true },
    });
    const tasks = planned.map((t) => {
      const minute = toLocal(t.scheduledAt!, tz).minute;
      // A "whenever" task lands at local midnight (the phone's acceptPayload does the same).
      return { title: t.title, time: minute === 0 ? null : hhmm(minute) };
    });
    if (tasks.length) return { blocks, tasks, suggestion: null, suggestionNote: null };
    if (!blocks.length) return { blocks, tasks, suggestion: null, suggestionNote: 'Es un día sin bloques de trabajo.' };

    const suggestion = await this.suggestionFor(userId, date, refresh);
    if (!suggestion) {
      return { blocks, tasks, suggestion: null, suggestionNote: 'No hay tareas pendientes sin fecha para proponer: agrega tareas y el plan se arma con ellas.' };
    }
    if (suggestion.status !== 'PENDING') {
      return { blocks, tasks, suggestion: null, suggestionNote: suggestion.status === 'DISMISSED' ? 'Descartaste el plan sugerido.' : null };
    }
    const view = this.view(suggestion);
    return {
      blocks,
      tasks,
      suggestion: {
        blocks: view.loose.length ? [...view.blocks, { label: 'En el día, sin bloque', start: '', end: '', tasks: view.loose }] : view.blocks,
        warnings: view.warnings,
      },
      suggestionNote: null,
    };
  }

  /** The day's stored suggestion, or a new one from the planner; null when it has nothing to place. */
  private async suggestionFor(userId: string, date: string, refresh: boolean): Promise<PlanSuggestion | null> {
    const existing = await this.prisma.planSuggestion.findUnique({ where: { userId_date: { userId, date } } });
    // An answered one stays answered; a pending one is rebuilt when asked (tasks may have changed).
    if (existing && (existing.status !== 'PENDING' || !refresh)) return existing;
    if (existing) await this.prisma.planSuggestion.delete({ where: { id: existing.id } });
    const proposal = await this.planning.propose(userId, { from: date, days: 1, timeZone: this.config.timeZone });
    if (!proposal.accepted.length) return null;
    const ids = proposal.accepted.map((a) => a.taskId);
    const [tasks, schedules] = await Promise.all([
      this.prisma.task.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } }),
      this.prisma.schedule.findMany({ where: { userId, kind: 'WORK' } }),
    ]);
    const stored: StoredProposal = {
      ...proposal,
      titles: Object.fromEntries(tasks.map((t) => [t.id, t.title])),
      slots: Object.fromEntries(
        schedules.map((s) => [s.id, { label: s.label ?? 'Bloque', startMinute: s.startMinute, endMinute: s.endMinute }]),
      ),
    };
    return this.prisma.planSuggestion.create({
      data: { userId, date, timeZone: this.config.timeZone, proposal: stored as unknown as Prisma.InputJsonValue },
    });
  }

  view(suggestion: PlanSuggestion): PlanSuggestionView {
    const p = suggestion.proposal as unknown as StoredProposal;
    const groups = new Map<string, ReportSuggestedBlock & { minute: number }>();
    const loose: PlanSuggestionView['loose'] = [];
    for (const a of p.accepted) {
      const task = { title: p.titles[a.taskId] ?? 'Tarea', reason: a.reason };
      const slot = a.scheduleId ? p.slots[a.scheduleId] : null;
      if (!slot) {
        loose.push(task);
        continue;
      }
      const group = groups.get(a.scheduleId!) ?? {
        label: slot.label,
        start: hhmm(slot.startMinute),
        end: hhmm(slot.endMinute),
        minute: slot.startMinute,
        tasks: [],
      };
      group.tasks.push(task);
      groups.set(a.scheduleId!, group);
    }
    return {
      id: suggestion.id,
      date: suggestion.date,
      status: suggestion.status,
      planner: p.planner,
      warnings: p.warnings,
      blocks: [...groups.values()].sort((a, b) => a.minute - b.minute).map(({ minute: _m, ...b }) => b),
      loose,
    };
  }

  /** The next pending suggestion from today on, if any. */
  async pending(userId: string): Promise<PlanSuggestionView | null> {
    const row = await this.prisma.planSuggestion.findFirst({
      where: { userId, status: 'PENDING', date: { gte: this.today() } },
      orderBy: { date: 'asc' },
    });
    return row ? this.view(row) : null;
  }

  /**
   * Puts the suggestion's tasks on the calendar, like accepting on the phone's Plan screen: each still
   * pending and unscheduled task gets its block's start (or the day, for "whenever" ones) and the
   * proposed priority. Tasks planned or done meanwhile are left alone.
   */
  async approve(userId: string, id: string): Promise<{ scheduled: number; skipped: number }> {
    const row = await this.owned(userId, id);
    const p = row.proposal as unknown as StoredProposal;
    const tasks = await this.prisma.task.findMany({ where: { userId, id: { in: p.accepted.map((a) => a.taskId) } } });
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const now = new Date();
    const writes = p.accepted.flatMap((a) => {
      const task = byId.get(a.taskId);
      if (!task || task.deletedAt || task.scheduledAt || !['PENDING', 'IN_PROGRESS'].includes(task.status)) return [];
      return [
        this.prisma.task.update({
          where: { id: task.id },
          data: { scheduledAt: fromLocal(a.date, a.startMinute ?? 0, row.timeZone), priority: a.priority, updatedAt: now },
        }),
      ];
    });
    await this.prisma.$transaction([
      ...writes,
      this.prisma.planSuggestion.update({ where: { id }, data: { status: 'APPROVED' } }),
    ]);
    if (writes.length) {
      this.syncEvents.notifyUser(userId, { sourceDeviceId: 'server', entities: ['tasks'], timestamp: now.toISOString() });
    }
    return { scheduled: writes.length, skipped: p.accepted.length - writes.length };
  }

  async dismiss(userId: string, id: string): Promise<void> {
    await this.owned(userId, id);
    await this.prisma.planSuggestion.update({ where: { id }, data: { status: 'DISMISSED' } });
  }

  private async owned(userId: string, id: string): Promise<PlanSuggestion> {
    const row = await this.prisma.planSuggestion.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException('Plan sugerido no encontrado.');
    return row;
  }
}

function previousDate(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}
