import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Task } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProposePlanDto } from './dto/propose-plan.dto';
import { validatePlan } from './plan-validator';
import { PLANNER, type Planner } from './planner';
import type { PlanningContext, PlanningTask, PlanProposal } from './planning.types';
import { buildSlots, dateRange, DEFAULT_POMODORO_MIN, slotKey, toLocal } from './slots';
import { studyLineOrder } from './study-line';

@Injectable()
export class PlanningService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PLANNER) private readonly planner: Planner,
  ) {}

  /** Builds a plan proposal. Read-only: accepting it is the client's job, through the sync batch. */
  async propose(userId: string, dto: ProposePlanDto): Promise<PlanProposal> {
    const ctx = await this.buildContext(userId, dto);
    const proposed = await this.planner.propose(ctx);
    const { accepted, rejected } = validatePlan(ctx, proposed);
    const placed = new Set(accepted.map((a) => a.taskId));
    return {
      planner: this.planner.name,
      days: ctx.days,
      accepted,
      rejected,
      unplaced: ctx.tasks.filter((t) => !placed.has(t.id)).map((t) => t.id),
    };
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
      category: t.category,
      priority: t.priority,
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
