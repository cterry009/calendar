import { BadRequestException, Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { Subscription } from 'rxjs';
import type { AttentionProfile, Task } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SyncEventsService } from '../realtime/sync-events.service';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { anchorFor, attentionProfileFor, loadAttentionDocs, PROFILE_BLOCK } from './attention';
import { rateWithModel } from './attention-labeler';
import { LayaClient, type LayaProfileAnswer } from './complexity';
import { LabelTasksDto } from './dto/label-tasks.dto';
import { StructureTaskDto } from './dto/structure-task.dto';
import { structureWithModel, type StructureContext, type StructuredTask } from './task-structurer';
import type { Generate } from './gemini-planner';
import { ProposePlanDto } from './dto/propose-plan.dto';
import { HeuristicPlanner } from './heuristic-planner';
import { validatePlan } from './plan-validator';
import { PLANNER, type Planner } from './planner';
import { planningConfig } from './planning.config';
import type { Assignment, PlanningContext, PlanningTask, PlanProposal } from './planning.types';
import { buildSlots, dateRange, DEFAULT_POMODORO_MIN, slotKey, toLocal } from './slots';
import { studyLineOrder } from './study-line';

export const LAYA = Symbol('LAYA');
export const GEMINI = Symbol('GEMINI');

export interface TaskLabel {
  taskId: string;
  title: string;
  source: 'REFERENCE' | 'MODEL';
  reentry: number;
  load: number;
  profile: AttentionProfile;
  reason: string;
}

export interface StructureResult {
  /** Gemini's structured task, with the profile from the fixed table. */
  task: StructuredTask;
  /** Laya's own pick of the profile, for comparison (not trained yet); null if Laya is off. */
  laya: LayaProfileAnswer | null;
  agree: boolean | null;
  /** Tasks saved, one per session, when `create` was set. */
  created: Array<{ id: string; title: string }>;
  warnings: string[];
}

export interface LabelResult {
  labels: TaskLabel[];
  /** Tasks left without a rating (no anchor and no model answer, or not a focus task). */
  unrated: Array<{ taskId: string; title: string; why: string }>;
  warnings: string[];
}

/** How long after the last task write to wait before rating, so a burst (an import) is one call. */
const AUTO_LABEL_DELAY_MS = 15_000;

@Injectable()
export class PlanningService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlanningService.name);
  private subscription: Subscription | null = null;
  private readonly pendingLabels = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PLANNER) private readonly planner: Planner,
    private readonly heuristic: HeuristicPlanner,
    @Inject(LAYA) private readonly laya: LayaClient | null,
    @Inject(GEMINI) private readonly gemini: Generate | null,
    private readonly syncEvents: SyncEventsService,
  ) {}

  // The AI's first entry point: a task created or edited on any device gets its attention rating
  // a few seconds later, without anyone asking (reference label if there is one, Gemini if not).
  onModuleInit() {
    this.subscription = this.syncEvents.tasksWritten$.subscribe((userId) => this.queueAutoLabel(userId));
  }

  onModuleDestroy() {
    this.subscription?.unsubscribe();
    for (const timer of this.pendingLabels.values()) clearTimeout(timer);
  }

  private queueAutoLabel(userId: string) {
    clearTimeout(this.pendingLabels.get(userId));
    this.pendingLabels.set(
      userId,
      setTimeout(() => {
        this.pendingLabels.delete(userId);
        void this.labelTasks(userId, {})
          .then((r) => {
            if (r.labels.length || r.warnings.length) {
              this.logger.log(`Calificación automática: ${r.labels.length} tareas. ${r.warnings.join(' ')}`);
            }
          })
          .catch((error: Error) => this.logger.warn(`Calificación automática falló: ${error.message}`));
      }, AUTO_LABEL_DELAY_MS),
    );
  }

  /**
   * Turns a loose idea into a structured task with Gemini (everything it knows: the user's rules,
   * the attention rubric, the study lines and the WORK blocks), and asks Laya for its own profile
   * to compare. With `create`, saves it as one unscheduled task per session for the planner.
   */
  async structureTask(userId: string, dto: StructureTaskDto): Promise<StructureResult> {
    if (!this.gemini) throw new BadRequestException('Falta GEMINI_API_KEY en el servidor.');
    const config = planningConfig();
    const docs = await loadAttentionDocs(config.attentionDocsPath).catch(() => {
      throw new BadRequestException(`No se pudieron leer las normas de atención en ${config.attentionDocsPath}.`);
    });
    const warnings: string[] = [];
    const rules = await readFile(config.rulesPath, 'utf8').catch(() => {
      warnings.push(`No se pudieron leer las reglas en ${config.rulesPath}; Gemini estructura sin ellas.`);
      return '';
    });

    const [pending, schedules] = await Promise.all([
      this.prisma.task.findMany({
        where: { userId, deletedAt: null, status: { in: ['PENDING', 'IN_PROGRESS'] }, category: { not: null } },
        select: { category: true },
      }),
      this.prisma.schedule.findMany({ where: { userId, kind: 'WORK', enabled: true } }),
    ]);
    const counts = new Map<string, number>();
    for (const t of pending) counts.set(t.category!, (counts.get(t.category!) ?? 0) + 1);
    const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const ctx: StructureContext = {
      rules,
      docs,
      lines: [...counts].map(([category, n]) => ({ category, pending: n })),
      blocks: schedules.map((s) => ({ scheduleId: s.id, label: s.label, days: s.daysOfWeek, start: hhmm(s.startMinute), end: hhmm(s.endMinute) })),
    };

    const task = await structureWithModel(ctx, dto.text, this.gemini, config.geminiModels, warnings).catch((error: Error) => {
      throw new BadRequestException(`Gemini no pudo estructurar la tarea: ${error.message}`);
    });

    let laya: LayaProfileAnswer | null = null;
    if (this.laya) {
      laya = await this.laya
        .profile({ tarea: task.title, detalle: task.description, ...(task.category ? { materia: task.category } : {}) })
        .catch((error: Error) => {
          warnings.push(`Laya no respondió: ${error.message}`);
          return null;
        });
    }

    const created: StructureResult['created'] = [];
    if (dto.create) {
      const block = PROFILE_BLOCK[task.profile];
      const group = randomUUID();
      const steps = task.steps.length ? `\nPasos por sesión: ${task.steps.join(' → ')}` : '';
      const now = new Date();
      for (let k = 1; k <= task.sessions; k++) {
        const row = await this.prisma.task.create({
          data: {
            userId,
            title: task.sessions > 1 ? `${task.title} (${k}/${task.sessions})` : task.title,
            description: `${task.description}${steps}\nEstructurada por Gemini a partir de: "${dto.text}"`,
            estimatedMinutes: block.blockMin,
            estimatedPomodoros: block.pomodoros,
            difficulty: task.difficulty,
            priority: task.priority,
            category: task.category,
            attentionReentry: task.reentry,
            attentionLoad: task.load,
            attentionProfile: task.profile,
            attentionSource: 'MODEL',
            attentionReason: `${task.type}: ${task.reason}`,
            clientId: `ai:${group}#${k}`,
            updatedAt: now,
          },
        });
        created.push({ id: row.id, title: row.title });
      }
      this.syncEvents.notifyUser(userId, { sourceDeviceId: 'server', entities: ['tasks'], timestamp: now.toISOString() });
    }

    return { task, laya, agree: laya ? laya.profile === task.profile : null, created, warnings };
  }

  /**
   * Rates pending tasks' attention (docs/planning/normas-de-atencion.md): reference labels first,
   * Gemini for the rest; the profile always comes from the fixed table. Never touches a rating the
   * user set, and only re-rates already-rated tasks with `force`.
   */
  async labelTasks(userId: string, dto: LabelTasksDto): Promise<LabelResult> {
    const config = planningConfig();
    const docs = await loadAttentionDocs(config.attentionDocsPath).catch(() => {
      throw new BadRequestException(`No se pudieron leer las normas de atención en ${config.attentionDocsPath}.`);
    });
    const pending = await this.prisma.task.findMany({
      where: { userId, deletedAt: null, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    });
    const targets = pending.filter((t) => t.attentionSource !== 'USER' && (dto.force || !t.attentionProfile));

    const result: LabelResult = { labels: [], unrated: [], warnings: [] };
    const forModel: Task[] = [];
    for (const t of targets) {
      const anchor = anchorFor(docs.anclas, t);
      if (!anchor) forModel.push(t);
      else if (anchor.R === null || anchor.C === null) result.unrated.push({ taskId: t.id, title: t.title, why: anchor.porque });
      else {
        result.labels.push({
          taskId: t.id,
          title: t.title,
          source: 'REFERENCE',
          reentry: anchor.R,
          load: anchor.C,
          profile: attentionProfileFor(anchor.R, anchor.C),
          reason: anchor.porque,
        });
      }
    }

    if (forModel.length && !this.gemini) {
      result.warnings.push('Sin GEMINI_API_KEY: las tareas sin etiqueta de referencia quedan sin calificar.');
      forModel.forEach((t) => result.unrated.push({ taskId: t.id, title: t.title, why: 'Sin modelo configurado.' }));
    } else if (forModel.length) {
      try {
        const ratings = await rateWithModel(docs, forModel, this.gemini!, config.geminiModels, result.warnings);
        const rated = new Map(ratings.map((r) => [r.taskId, r]));
        for (const t of forModel) {
          const r = rated.get(t.id);
          if (!r) result.unrated.push({ taskId: t.id, title: t.title, why: 'El modelo no la etiquetó.' });
          else {
            result.labels.push({
              taskId: t.id,
              title: t.title,
              source: 'MODEL',
              reentry: r.reentry,
              load: r.load,
              profile: attentionProfileFor(r.reentry, r.load),
              reason: `${r.tipo}: ${r.reason}`,
            });
          }
        }
      } catch (error) {
        result.warnings.push(`No se pudo etiquetar con Gemini: ${(error as Error).message}`);
        forModel.forEach((t) => result.unrated.push({ taskId: t.id, title: t.title, why: 'Gemini no respondió.' }));
      }
    }

    if (result.labels.length) {
      const now = new Date();
      await this.prisma.$transaction(
        result.labels.map((l) =>
          this.prisma.task.update({
            where: { id: l.taskId },
            data: {
              attentionReentry: l.reentry,
              attentionLoad: l.load,
              attentionProfile: l.profile,
              attentionSource: l.source,
              attentionReason: l.reason,
              updatedAt: now,
            },
          }),
        ),
      );
      // Other devices refetch their tasks to pick the ratings up.
      this.syncEvents.notifyUser(userId, { sourceDeviceId: 'server', entities: ['tasks'], timestamp: now.toISOString() });
    }
    return result;
  }

  /** Builds a plan proposal. Read-only: accepting it is the client's job, through the sync batch. */
  async propose(userId: string, dto: ProposePlanDto): Promise<PlanProposal> {
    const warnings: string[] = [];
    const ctx = await this.buildContext(userId, dto);
    const complexitySource = await this.rateComplexity(ctx, warnings);

    // An outside planner that fails (no quota, no network, bad answer) doesn't fail the request:
    // the heuristic answers instead, and the proposal says so.
    let planner = this.planner;
    let proposed: Assignment[];
    try {
      proposed = await planner.propose(ctx, warnings);
    } catch (error) {
      if (planner === this.heuristic) throw error;
      warnings.push(`${planner.name} falló, se usó el planificador heurístico: ${(error as Error).message}`);
      this.logger.warn(warnings.at(-1));
      planner = this.heuristic;
      proposed = await planner.propose(ctx);
    }

    const { accepted, rejected, blocks } = validatePlan(ctx, proposed);
    const placed = new Set(accepted.map((a) => a.taskId));
    return {
      planner: planner.name,
      complexitySource,
      warnings,
      days: ctx.days,
      accepted,
      rejected,
      blocks,
      unplaced: ctx.tasks.filter((t) => !placed.has(t.id)).map((t) => t.id),
    };
  }

  /** Overwrites each task's stored complexity with Laya's, when Laya is configured and answers. */
  private async rateComplexity(ctx: PlanningContext, warnings: string[]): Promise<string> {
    if (!this.laya || ctx.tasks.length === 0) return 'stored';
    try {
      const scores = await this.laya.score(ctx.tasks);
      for (const t of ctx.tasks) t.complexity = scores.get(t.id) ?? t.complexity;
      return 'laya';
    } catch (error) {
      warnings.push(`Laya no respondió, se usó la complejidad guardada en cada tarea: ${(error as Error).message}`);
      this.logger.warn(warnings.at(-1));
      return 'stored';
    }
  }

  async buildContext(userId: string, dto: ProposePlanDto): Promise<PlanningContext> {
    const timeZone = dto.timeZone ?? 'UTC';
    try {
      new Intl.DateTimeFormat('en', { timeZone });
    } catch {
      throw new BadRequestException(`Zona horaria desconocida: ${timeZone}`);
    }
    const days = dateRange(dto.from ?? toLocal(new Date(), timeZone).date, dto.days ?? 7);

    const [pending, schedules] = await Promise.all([
      this.prisma.task.findMany({
        where: { userId, deletedAt: null, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      }),
      this.prisma.schedule.findMany({ where: { userId, kind: 'WORK', enabled: true } }),
    ]);

    const lines = studyLineOrder(pending.map((t) => t.clientId));
    const toPlanning = (t: Task): PlanningTask => ({
      id: t.id,
      title: t.title,
      description: t.description,
      category: t.category,
      priority: t.priority,
      difficulty: t.difficulty,
      complexity: t.complexity,
      attentionProfile: t.attentionProfile,
      pomodoros: t.estimatedPomodoros ?? Math.max(1, Math.ceil(t.estimatedMinutes / DEFAULT_POMODORO_MIN)),
      scheduledDate: t.scheduledAt ? toLocal(t.scheduledAt, timeZone).date : null,
      line: (t.clientId && lines.get(t.clientId)) || null,
    });

    const only = dto.taskIds ? new Set(dto.taskIds) : null;
    const tasks = pending.filter((t) => !t.scheduledAt && (!only || only.has(t.id))).map(toPlanning);
    const scheduled = pending.filter((t) => t.scheduledAt).map(toPlanning);

    // Blocks of today that already started are no place to put new work.
    const now = toLocal(new Date(), timeZone);
    const slots = buildSlots(schedules, days).filter((s) => s.date > now.date || (s.date === now.date && s.startMinute > now.minute));
    // Tasks already on the calendar take room in the block their start time falls in.
    const byKey = new Map(slots.map((s) => [slotKey(s.scheduleId, s.date), s]));
    for (const t of pending) {
      if (!t.scheduledAt) continue;
      const local = toLocal(t.scheduledAt, timeZone);
      const slot = schedules
        .map((s) => byKey.get(slotKey(s.id, local.date)))
        .find((s) => s && local.minute >= s.startMinute && local.minute < s.endMinute);
      if (slot) slot.used += toPlanning(t).pomodoros;
    }

    return { days, tasks, scheduled, slots };
  }
}
