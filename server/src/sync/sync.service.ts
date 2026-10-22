import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SyncEventsService } from '../realtime/sync-events.service';
import {
  BlockEventSyncChangeDto,
  FocusEventSyncChangeDto,
  ExerciseAttemptSyncChangeDto,
  BlockListSyncChangeDto,
  DailyDesktopAppTimeSyncChangeDto,
  DailyGameTimeSyncChangeDto,
  DailyScreenTimeSyncChangeDto,
  DetoxPlanSyncChangeDto,
  FitnessSyncChangeDto,
  FloorsClimbedSyncChangeDto,
  FocusTriggerSyncChangeDto,
  HabitRecordSyncChangeDto,
  HabitSyncChangeDto,
  ScheduleCompletionSyncChangeDto,
  ScheduleExceptionSyncChangeDto,
  StudyPlanSyncChangeDto,
  JournalEntrySyncChangeDto,
  PomodoroSyncChangeDto,
  ScheduleSyncChangeDto,
  SerotoninSessionSyncChangeDto,
  StepCountSyncChangeDto,
  SyncBatchDto,
  TaskSyncChangeDto,
} from './dto/sync-batch.dto';
import { SyncBatchResult, SyncChangeResult, SyncEntityType } from './sync.types';

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly syncEvents: SyncEventsService,
  ) {}

  async pullSnapshot(userId: string) {
    const [
      tasks,
      schedules,
      pomodoroSessions,
      blockListEntries,
      focusTriggers,
      fitnessEntries,
      dailyStepCounts,
      dailyFloorsClimbed,
      blockEvents,
      dailyScreenTime,
      dailyGameTime,
      dailyDesktopAppTime,
      detoxPlan,
      serotoninSession,
      habits,
      habitRecords,
      journalEntries,
      scheduleCompletions,
      scheduleExceptions,
      studyPlan,
      exerciseAttempts,
    ] = await Promise.all([
      this.prisma.task.findMany({
        where: { userId, deletedAt: null },
      }),
      this.prisma.schedule.findMany({ where: { userId } }),
      this.prisma.pomodoroSession.findMany({ where: { userId } }),
      this.prisma.blockListEntry.findMany({ where: { userId } }),
      this.prisma.focusTrigger.findMany({ where: { userId } }),
      this.prisma.fitnessEntry.findMany({ where: { userId } }),
      this.prisma.dailyStepCount.findMany({ where: { userId } }),
      this.prisma.dailyFloorsClimbed.findMany({ where: { userId } }),
      // Bounded to the last 30 days -- unlike every other synced entity here, a block event is a
      // high-frequency telemetry row (potentially dozens a day), not something the client ever
      // needs its full lifetime history of on every pull. The dashboard trend (task 8.4/8.6) only
      // ever looks at a recent window anyway.
      this.prisma.blockEvent.findMany({
        where: { userId, occurredAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        orderBy: { occurredAt: 'desc' },
      }),
      this.prisma.dailyScreenTime.findMany({ where: { userId } }),
      this.prisma.dailyGameTime.findMany({ where: { userId } }),
      this.prisma.dailyDesktopAppTime.findMany({ where: { userId } }),
      this.prisma.detoxPlan.findUnique({ where: { userId } }),
      this.prisma.serotoninSession.findUnique({ where: { userId } }),
      this.prisma.habit.findMany({ where: { userId, deletedAt: null } }),
      this.prisma.habitRecord.findMany({ where: { userId } }),
      this.prisma.journalEntry.findMany({ where: { userId } }),
      // Last 60 days: clients only show "done" marks on the calendar around the current weeks,
      // and this grows by up to ~20 rows a day.
      this.prisma.scheduleCompletion.findMany({
        where: { userId, date: { gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) } },
      }),
      // From 60 days back too, plus every future one: exceptions are planned ahead.
      this.prisma.scheduleException.findMany({
        where: { userId, date: { gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) } },
      }),
      this.prisma.studyPlan.findUnique({ where: { userId } }),
      // Every attempt, unlike block events: the study game is replayed from the whole history
      // (study-tutor-game D6, D21). The long texts stay out (GET /sync/exercise-attempts has them),
      // so a year of ~7 000 attempts is ~1.5 MB instead of ~5.
      this.prisma.exerciseAttempt.findMany({
        where: { userId },
        omit: { generatedStatement: true, feedback: true },
        orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      }),
    ]);

    return {
      tasks,
      schedules,
      pomodoroSessions,
      blockListEntries,
      focusTriggers,
      fitnessEntries,
      dailyStepCounts,
      dailyFloorsClimbed,
      blockEvents,
      dailyScreenTime,
      dailyGameTime,
      dailyDesktopAppTime,
      habits,
      habitRecords,
      journalEntries,
      scheduleCompletions,
      scheduleExceptions,
      exerciseAttempts,
      studyPlan: studyPlan
        ? {
            id: studyPlan.id,
            planData: studyPlan.planData,
            updatedAt: studyPlan.updatedAt.toISOString(),
            createdAt: studyPlan.createdAt.toISOString(),
          }
        : null,
      detoxPlan: detoxPlan
        ? {
            id: detoxPlan.id,
            planData: detoxPlan.planData,
            updatedAt: detoxPlan.updatedAt.toISOString(),
            createdAt: detoxPlan.createdAt.toISOString(),
          }
        : null,
      serotoninSession: serotoninSession
        ? {
            id: serotoninSession.id,
            sessionData: serotoninSession.sessionData,
            updatedAt: serotoninSession.updatedAt.toISOString(),
            createdAt: serotoninSession.createdAt.toISOString(),
          }
        : null,
      syncedAt: new Date().toISOString(),
    };
  }

  async processBatch(
    userId: string,
    deviceId: string,
    dto: SyncBatchDto,
  ): Promise<SyncBatchResult> {
    const result: SyncBatchResult = { applied: {}, conflicts: {} };
    const changedEntities = new Set<SyncEntityType>();

    if (dto.tasks?.length) {
      result.applied.tasks = [];
      result.conflicts.tasks = [];
      for (const change of dto.tasks) {
        const outcome = await this.applyTaskChange(userId, change);
        this.bucketResult(result, 'tasks', outcome);
        if (outcome.status === 'applied') {
          changedEntities.add('tasks');
        }
      }
      if (changedEntities.has('tasks') && dto.tasks.some((change) => !change.deleted)) {
        this.syncEvents.taskWritten?.(userId);
      }
    }

    if (dto.schedules?.length) {
      result.applied.schedules = [];
      result.conflicts.schedules = [];
      for (const change of dto.schedules) {
        const outcome = await this.applyScheduleChange(userId, change);
        this.bucketResult(result, 'schedules', outcome);
        if (outcome.status === 'applied') {
          changedEntities.add('schedules');
        }
      }
    }

    if (dto.pomodoroSessions?.length) {
      result.applied.pomodoroSessions = [];
      result.conflicts.pomodoroSessions = [];
      for (const change of dto.pomodoroSessions) {
        const outcome = await this.applyPomodoroChange(userId, change);
        this.bucketResult(result, 'pomodoroSessions', outcome);
        if (outcome.status === 'applied') {
          changedEntities.add('pomodoroSessions');
        }
      }
    }

    if (dto.blockListEntries?.length) {
      result.applied.blockListEntries = [];
      result.conflicts.blockListEntries = [];
      for (const change of dto.blockListEntries) {
        const outcome = await this.applyBlockListChange(userId, change);
        this.bucketResult(result, 'blockListEntries', outcome);
        if (outcome.status === 'applied') {
          changedEntities.add('blockListEntries');
        }
      }
    }

    if (dto.focusTriggers?.length) {
      result.applied.focusTriggers = [];
      result.conflicts.focusTriggers = [];
      for (const change of dto.focusTriggers) {
        const outcome = await this.applyFocusTriggerChange(userId, change);
        this.bucketResult(result, 'focusTriggers', outcome);
        if (outcome.status === 'applied') {
          changedEntities.add('focusTriggers');
        }
      }
    }

    if (dto.fitnessEntries?.length) {
      result.applied.fitnessEntries = [];
      result.conflicts.fitnessEntries = [];
      for (const change of dto.fitnessEntries) {
        const outcome = await this.applyFitnessChange(userId, change);
        this.bucketResult(result, 'fitnessEntries', outcome);
        if (outcome.status === 'applied') {
          changedEntities.add('fitnessEntries');
        }
      }
    }

    if (dto.dailyStepCounts?.length) {
      result.applied.dailyStepCounts = [];
      result.conflicts.dailyStepCounts = [];
      for (const change of dto.dailyStepCounts) {
        const outcome = await this.applyStepCountChange(userId, change);
        this.bucketResult(result, 'dailyStepCounts', outcome);
        if (outcome.status === 'applied') {
          changedEntities.add('dailyStepCounts');
        }
      }
    }

    if (dto.dailyFloorsClimbed?.length) {
      result.applied.dailyFloorsClimbed = [];
      result.conflicts.dailyFloorsClimbed = [];
      for (const change of dto.dailyFloorsClimbed) {
        const outcome = await this.applyFloorsClimbedChange(userId, change);
        this.bucketResult(result, 'dailyFloorsClimbed', outcome);
        if (outcome.status === 'applied') {
          changedEntities.add('dailyFloorsClimbed');
        }
      }
    }

    if (dto.blockEvents?.length) {
      result.applied.blockEvents = [];
      result.conflicts.blockEvents = [];
      for (const change of dto.blockEvents) {
        const outcome = await this.applyBlockEventChange(userId, change);
        this.bucketResult(result, 'blockEvents', outcome);
        if (outcome.status === 'applied') {
          changedEntities.add('blockEvents');
        }
      }
    }

    if (dto.focusEvents?.length) {
      result.applied.focusEvents = [];
      result.conflicts.focusEvents = [];
      for (const change of dto.focusEvents) {
        const outcome = await this.applyFocusEventChange(userId, change);
        this.bucketResult(result, 'focusEvents', outcome);
        if (outcome.status === 'applied') {
          changedEntities.add('focusEvents');
        }
      }
    }

    if (dto.exerciseAttempts?.length) {
      result.applied.exerciseAttempts = [];
      result.conflicts.exerciseAttempts = [];
      for (const change of dto.exerciseAttempts) {
        const outcome = await this.applyExerciseAttemptChange(userId, change);
        this.bucketResult(result, 'exerciseAttempts', outcome);
        if (outcome.status === 'applied') {
          changedEntities.add('exerciseAttempts');
        }
      }
    }

    if (dto.dailyScreenTime?.length) {
      result.applied.dailyScreenTime = [];
      result.conflicts.dailyScreenTime = [];
      for (const change of dto.dailyScreenTime) {
        const outcome = await this.applyDailyScreenTimeChange(userId, change);
        this.bucketResult(result, 'dailyScreenTime', outcome);
        if (outcome.status === 'applied') {
          changedEntities.add('dailyScreenTime');
        }
      }
    }

    if (dto.dailyGameTime?.length) {
      result.applied.dailyGameTime = [];
      result.conflicts.dailyGameTime = [];
      for (const change of dto.dailyGameTime) {
        const outcome = await this.applyDailyGameTimeChange(userId, change);
        this.bucketResult(result, 'dailyGameTime', outcome);
        if (outcome.status === 'applied') {
          changedEntities.add('dailyGameTime');
        }
      }
    }

    if (dto.dailyDesktopAppTime?.length) {
      result.applied.dailyDesktopAppTime = [];
      result.conflicts.dailyDesktopAppTime = [];
      for (const change of dto.dailyDesktopAppTime) {
        const outcome = await this.applyDailyDesktopAppTimeChange(userId, change);
        this.bucketResult(result, 'dailyDesktopAppTime', outcome);
        if (outcome.status === 'applied') {
          changedEntities.add('dailyDesktopAppTime');
        }
      }
    }

    if (dto.detoxPlan?.length) {
      result.applied.detoxPlan = [];
      result.conflicts.detoxPlan = [];
      for (const change of dto.detoxPlan) {
        const outcome = await this.applyDetoxPlanChange(userId, change);
        this.bucketResult(result, 'detoxPlan', outcome);
        if (outcome.status === 'applied') {
          changedEntities.add('detoxPlan');
        }
      }
    }

    if (dto.serotoninSession?.length) {
      result.applied.serotoninSession = [];
      result.conflicts.serotoninSession = [];
      for (const change of dto.serotoninSession) {
        const outcome = await this.applySerotoninSessionChange(userId, change);
        this.bucketResult(result, 'serotoninSession', outcome);
        if (outcome.status === 'applied') {
          changedEntities.add('serotoninSession');
        }
      }
    }

    if (dto.habits?.length) {
      result.applied.habits = [];
      result.conflicts.habits = [];
      for (const change of dto.habits) {
        const outcome = await this.applyHabitChange(userId, change);
        this.bucketResult(result, 'habits', outcome);
        if (outcome.status === 'applied') {
          changedEntities.add('habits');
        }
      }
    }

    if (dto.habitRecords?.length) {
      result.applied.habitRecords = [];
      result.conflicts.habitRecords = [];
      for (const change of dto.habitRecords) {
        const outcome = await this.applyHabitRecordChange(userId, change);
        this.bucketResult(result, 'habitRecords', outcome);
        if (outcome.status === 'applied') {
          changedEntities.add('habitRecords');
        }
      }
    }

    if (dto.scheduleCompletions?.length) {
      result.applied.scheduleCompletions = [];
      result.conflicts.scheduleCompletions = [];
      for (const change of dto.scheduleCompletions) {
        const outcome = await this.applyScheduleCompletionChange(userId, change);
        this.bucketResult(result, 'scheduleCompletions', outcome);
        if (outcome.status === 'applied') {
          changedEntities.add('scheduleCompletions');
        }
      }
    }

    if (dto.scheduleExceptions?.length) {
      result.applied.scheduleExceptions = [];
      result.conflicts.scheduleExceptions = [];
      for (const change of dto.scheduleExceptions) {
        const outcome = await this.applyScheduleExceptionChange(userId, change);
        this.bucketResult(result, 'scheduleExceptions', outcome);
        if (outcome.status === 'applied') {
          changedEntities.add('scheduleExceptions');
        }
      }
    }

    if (dto.studyPlan?.length) {
      result.applied.studyPlan = [];
      result.conflicts.studyPlan = [];
      for (const change of dto.studyPlan) {
        const outcome = await this.applyStudyPlanChange(userId, change);
        this.bucketResult(result, 'studyPlan', outcome);
        if (outcome.status === 'applied') {
          changedEntities.add('studyPlan');
        }
      }
    }

    if (dto.journalEntries?.length) {
      result.applied.journalEntries = [];
      result.conflicts.journalEntries = [];
      for (const change of dto.journalEntries) {
        const outcome = await this.applyJournalEntryChange(userId, change);
        this.bucketResult(result, 'journalEntries', outcome);
        if (outcome.status === 'applied') {
          changedEntities.add('journalEntries');
        }
      }
    }

    if (changedEntities.size > 0) {
      this.syncEvents.notifyUser(userId, {
        sourceDeviceId: deviceId,
        entities: [...changedEntities],
        timestamp: new Date().toISOString(),
      });
    }

    return this.compactResult(result);
  }

  private bucketResult(result: SyncBatchResult, entity: SyncEntityType, outcome: SyncChangeResult) {
    if (outcome.status === 'conflict') {
      result.conflicts[entity]?.push(outcome);
      return;
    }
    result.applied[entity]?.push(outcome);
  }

  private compactResult(result: SyncBatchResult): SyncBatchResult {
    for (const key of Object.keys(result.applied) as SyncEntityType[]) {
      if (!result.applied[key]?.length) {
        delete result.applied[key];
      }
    }
    for (const key of Object.keys(result.conflicts) as SyncEntityType[]) {
      if (!result.conflicts[key]?.length) {
        delete result.conflicts[key];
      }
    }
    return result;
  }

  private isServerNewer(serverUpdatedAt: Date, clientUpdatedAt: string) {
    return serverUpdatedAt.getTime() > new Date(clientUpdatedAt).getTime();
  }

  private clientKey(change: { id?: string; clientId?: string }) {
    return change.id ?? change.clientId;
  }

  private async applyTaskChange(
    userId: string,
    change: TaskSyncChangeDto,
  ): Promise<SyncChangeResult> {
    const existing = await this.findTask(userId, change);
    const key = this.clientKey(change);

    if (change.deleted) {
      if (!existing) {
        return { status: 'skipped', clientKey: key };
      }
      if (this.isServerNewer(existing.updatedAt, change.updatedAt)) {
        return { status: 'conflict', clientKey: key, server: existing };
      }
      const record = await this.prisma.task.update({
        where: { id: existing.id },
        data: { deletedAt: new Date(), updatedAt: new Date(change.updatedAt) },
      });
      return { status: 'applied', clientKey: key, record };
    }

    if (!change.title || change.estimatedMinutes === undefined) {
      throw new BadRequestException('Task changes require title and estimatedMinutes');
    }

    if (existing && this.isServerNewer(existing.updatedAt, change.updatedAt)) {
      return { status: 'conflict', clientKey: key, server: existing };
    }

    const data = {
      title: change.title,
      description: change.description ?? null,
      scheduledAt: change.scheduledAt ? new Date(change.scheduledAt) : null,
      estimatedMinutes: change.estimatedMinutes,
      estimatedPomodoros: change.estimatedPomodoros ?? null,
      actualMinutes: change.actualMinutes ?? null,
      difficulty: change.difficulty,
      complexity: change.complexity,
      attentionReentry: change.attentionReentry,
      attentionLoad: change.attentionLoad,
      attentionProfile: change.attentionProfile,
      attentionSource: change.attentionSource,
      attentionReason: change.attentionReason,
      priority: change.priority,
      category: change.category ?? null,
      status: change.status,
      completedAt: change.completedAt ? new Date(change.completedAt) : null,
      clientId: change.clientId ?? existing?.clientId ?? null,
      updatedAt: new Date(change.updatedAt),
      deletedAt: null,
    };

    const record = existing
      ? await this.prisma.task.update({ where: { id: existing.id }, data })
      : await this.prisma.task.create({ data: { ...data, userId } });

    return { status: 'applied', clientKey: key, record };
  }

  private findTask(userId: string, change: TaskSyncChangeDto) {
    if (change.id) {
      return this.prisma.task.findFirst({ where: { id: change.id, userId } });
    }
    if (change.clientId) {
      return this.prisma.task.findFirst({
        where: { userId, clientId: change.clientId },
      });
    }
    return null;
  }

  private async applyScheduleChange(
    userId: string,
    change: ScheduleSyncChangeDto,
  ): Promise<SyncChangeResult> {
    const existing = change.id
      ? await this.prisma.schedule.findFirst({ where: { id: change.id, userId } })
      : null;
    const key = change.id;

    if (change.deleted) {
      if (!existing) {
        return { status: 'skipped', clientKey: key };
      }
      if (this.isServerNewer(existing.updatedAt, change.updatedAt)) {
        return { status: 'conflict', clientKey: key, server: existing };
      }
      await this.prisma.schedule.delete({ where: { id: existing.id } });
      // Its running block session ends with it (2026-10-16: an old block kept "running" after the
      // timetable replaced it, and held the new block's pomodoro back).
      await this.prisma.pomodoroSession.updateMany({
        where: { userId, scheduleId: existing.id, active: true },
        data: { active: false, state: 'IDLE', interrupted: true, pausedAt: null, endedAt: new Date() },
      });
      return { status: 'applied', clientKey: key, record: { id: existing.id } };
    }

    if (
      change.kind === undefined ||
      change.daysOfWeek === undefined ||
      change.startMinute === undefined ||
      change.endMinute === undefined
    ) {
      throw new BadRequestException(
        'Schedule changes require kind, daysOfWeek, startMinute, and endMinute',
      );
    }

    if (existing && this.isServerNewer(existing.updatedAt, change.updatedAt)) {
      return { status: 'conflict', clientKey: key, server: existing };
    }

    const data = {
      kind: change.kind,
      daysOfWeek: change.daysOfWeek,
      startMinute: change.startMinute,
      endMinute: change.endMinute,
      label: change.label ?? null,
      enabled: change.enabled ?? true,
      pomodoroMin: change.pomodoroMin ?? null,
      shortBreakMin: change.shortBreakMin ?? null,
      longBreakMin: change.longBreakMin ?? null,
      pomodorosPerChunk: change.pomodorosPerChunk ?? null,
      chunks: change.chunks ?? null,
      // Not sent (a client from before 2026-10-15) keeps what the block has; null clears it.
      category: change.category === undefined ? (existing?.category ?? null) : change.category,
      sequence: jsonOrNull(change.sequence === undefined ? existing?.sequence : change.sequence),
      flexibleBlocks:
        change.flexibleBlocks === undefined ? (existing?.flexibleBlocks ?? null) : change.flexibleBlocks,
      updatedAt: new Date(change.updatedAt),
    };

    const record = existing
      ? await this.prisma.schedule.update({ where: { id: existing.id }, data })
      : await this.prisma.schedule.create({ data: { ...data, userId } });

    return { status: 'applied', clientKey: key, record };
  }

  private async applyPomodoroChange(
    userId: string,
    change: PomodoroSyncChangeDto,
  ): Promise<SyncChangeResult> {
    const existing = change.id
      ? await this.prisma.pomodoroSession.findFirst({
          where: { id: change.id, userId },
        })
      : null;
    const key = change.id;

    if (change.deleted) {
      if (!existing) {
        return { status: 'skipped', clientKey: key };
      }
      if (this.isServerNewer(existing.updatedAt, change.updatedAt)) {
        return { status: 'conflict', clientKey: key, server: existing };
      }
      await this.prisma.pomodoroSession.delete({ where: { id: existing.id } });
      return { status: 'applied', clientKey: key, record: { id: existing.id } };
    }

    if (existing && this.isServerNewer(existing.updatedAt, change.updatedAt)) {
      return { status: 'conflict', clientKey: key, server: existing };
    }

    // A block session for a block that no longer exists is stored already ended. Found 2026-10-16:
    // the desktop, still showing its cached pre-timetable blocks, started a deleted 09:00 block,
    // which then blocked apps and kept the real 09:30 block from starting on every device.
    if (change.scheduleId && change.active) {
      const schedule = await this.prisma.schedule.findFirst({
        where: { id: change.scheduleId, userId },
        select: { id: true },
      });
      if (!schedule) {
        change = {
          ...change,
          active: false,
          state: 'IDLE',
          interrupted: true,
          pausedAt: null,
          endedAt: change.endedAt ?? new Date().toISOString(),
        };
      }
    }

    const data = {
      taskId: change.taskId ?? null,
      state: change.state,
      focusDurationMin: change.focusDurationMin,
      shortBreakMin: change.shortBreakMin,
      longBreakMin: change.longBreakMin,
      cyclesBeforeLongBreak: change.cyclesBeforeLongBreak,
      completedCycles: change.completedCycles,
      active: change.active,
      interrupted: change.interrupted,
      startedAt: change.startedAt ? new Date(change.startedAt) : null,
      endedAt: change.endedAt ? new Date(change.endedAt) : null,
      blockEndAt: change.blockEndAt ? new Date(change.blockEndAt) : null,
      attentionProfile: change.attentionProfile ?? null,
      scheduleId: change.scheduleId ?? null,
      pausedAt: change.pausedAt ? new Date(change.pausedAt) : null,
      exitCount: change.exitCount ?? 0,
      // Never goes down: a device that hasn't heard of a review yet mustn't undo it.
      reviewedCycles: Math.max(existing?.reviewedCycles ?? 0, change.reviewedCycles ?? 0),
      // Sequence mode: a client that doesn't know these fields keeps them as they are.
      ...sequenceSessionFields(change, existing),
      updatedAt: new Date(change.updatedAt),
    };

    const record = existing
      ? await this.prisma.pomodoroSession.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.pomodoroSession.create({
          data: {
            // Keep the client's id: it already logged focus events under it, and a retried
            // offline change must find this row instead of creating a second one.
            ...(change.id ? { id: change.id } : {}),
            userId,
            taskId: change.taskId ?? null,
            state: change.state ?? 'IDLE',
            focusDurationMin: change.focusDurationMin ?? 25,
            shortBreakMin: change.shortBreakMin ?? 5,
            longBreakMin: change.longBreakMin ?? 15,
            cyclesBeforeLongBreak: change.cyclesBeforeLongBreak ?? 4,
            completedCycles: change.completedCycles ?? 0,
            active: change.active ?? false,
            interrupted: change.interrupted ?? false,
            startedAt: change.startedAt ? new Date(change.startedAt) : null,
            endedAt: change.endedAt ? new Date(change.endedAt) : null,
            blockEndAt: change.blockEndAt ? new Date(change.blockEndAt) : null,
            attentionProfile: change.attentionProfile ?? null,
            scheduleId: change.scheduleId ?? null,
            pausedAt: change.pausedAt ? new Date(change.pausedAt) : null,
            exitCount: change.exitCount ?? 0,
            reviewedCycles: change.reviewedCycles ?? 0,
            ...sequenceSessionFields(change, null),
            updatedAt: new Date(change.updatedAt),
          },
        });

    return { status: 'applied', clientKey: key, record };
  }

  private async applyBlockListChange(
    userId: string,
    change: BlockListSyncChangeDto,
  ): Promise<SyncChangeResult> {
    const existing = change.id
      ? await this.prisma.blockListEntry.findFirst({
          where: { id: change.id, userId },
        })
      : null;
    const key = change.id;

    if (change.deleted) {
      if (!existing) {
        return { status: 'skipped', clientKey: key };
      }
      if (this.isServerNewer(existing.updatedAt, change.updatedAt)) {
        return { status: 'conflict', clientKey: key, server: existing };
      }
      await this.prisma.blockListEntry.delete({ where: { id: existing.id } });
      return { status: 'applied', clientKey: key, record: { id: existing.id } };
    }

    if (!change.kind || !change.identifier || !change.label) {
      throw new BadRequestException('Block list changes require kind, identifier, and label');
    }

    if (existing && this.isServerNewer(existing.updatedAt, change.updatedAt)) {
      return { status: 'conflict', clientKey: key, server: existing };
    }

    const data = {
      kind: change.kind,
      identifier: change.identifier,
      label: change.label,
      platform: change.platform ?? null,
      highDopamine: change.highDopamine ?? false,
      enabled: change.enabled ?? true,
      hardMode: change.hardMode ?? false,
      scope: change.scope ?? existing?.scope ?? ('FOCUS' as const),
      updatedAt: new Date(change.updatedAt),
    };

    const record = existing
      ? await this.prisma.blockListEntry.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.blockListEntry.create({ data: { ...data, userId } });

    return { status: 'applied', clientKey: key, record };
  }

  private async applyFocusTriggerChange(
    userId: string,
    change: FocusTriggerSyncChangeDto,
  ): Promise<SyncChangeResult> {
    const existing = change.id
      ? await this.prisma.focusTrigger.findFirst({
          where: { id: change.id, userId },
        })
      : null;
    const key = change.id;

    if (change.deleted) {
      if (!existing) {
        return { status: 'skipped', clientKey: key };
      }
      if (this.isServerNewer(existing.updatedAt, change.updatedAt)) {
        return { status: 'conflict', clientKey: key, server: existing };
      }
      await this.prisma.focusTrigger.delete({ where: { id: existing.id } });
      return { status: 'applied', clientKey: key, record: { id: existing.id } };
    }

    if (!change.kind || !change.label) {
      throw new BadRequestException('Focus trigger changes require kind and label');
    }
    if (
      change.kind === 'LOCATION' &&
      (change.latitude == null || change.longitude == null || change.radiusMeters == null)
    ) {
      throw new BadRequestException(
        'Location triggers require latitude, longitude, and radiusMeters',
      );
    }
    if (change.kind === 'WIFI' && !change.wifiSsid) {
      throw new BadRequestException('Wi-Fi triggers require wifiSsid');
    }

    if (existing && this.isServerNewer(existing.updatedAt, change.updatedAt)) {
      return { status: 'conflict', clientKey: key, server: existing };
    }

    const data = {
      kind: change.kind,
      label: change.label,
      enabled: change.enabled ?? true,
      latitude: change.latitude ?? null,
      longitude: change.longitude ?? null,
      radiusMeters: change.radiusMeters ?? null,
      wifiSsid: change.wifiSsid ?? null,
      updatedAt: new Date(change.updatedAt),
    };

    const record = existing
      ? await this.prisma.focusTrigger.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.focusTrigger.create({ data: { ...data, userId } });

    return { status: 'applied', clientKey: key, record };
  }

  private async applyFitnessChange(
    userId: string,
    change: FitnessSyncChangeDto,
  ): Promise<SyncChangeResult> {
    const existing = change.id
      ? await this.prisma.fitnessEntry.findFirst({
          where: { id: change.id, userId },
        })
      : null;
    const key = change.id;

    if (change.deleted) {
      if (!existing) {
        return { status: 'skipped', clientKey: key };
      }
      if (this.isServerNewer(existing.updatedAt, change.updatedAt)) {
        return { status: 'conflict', clientKey: key, server: existing };
      }
      await this.prisma.fitnessEntry.delete({ where: { id: existing.id } });
      return { status: 'applied', clientKey: key, record: { id: existing.id } };
    }

    if (!change.activityType || !change.durationMinutes || !change.loggedAt) {
      throw new BadRequestException(
        'Fitness changes require activityType, durationMinutes, and loggedAt',
      );
    }

    if (existing && this.isServerNewer(existing.updatedAt, change.updatedAt)) {
      return { status: 'conflict', clientKey: key, server: existing };
    }

    const data = {
      activityType: change.activityType,
      durationMinutes: change.durationMinutes,
      intensity: change.intensity,
      notes: change.notes ?? null,
      loggedAt: new Date(change.loggedAt),
      source: change.source,
      externalId: change.externalId ?? null,
      updatedAt: new Date(change.updatedAt),
    };

    const record = existing
      ? await this.prisma.fitnessEntry.update({ where: { id: existing.id }, data })
      : await this.prisma.fitnessEntry.create({ data: { ...data, userId } });

    await this.autoCompleteHabitsFromFitness(userId, record);

    return { status: 'applied', clientKey: key, record };
  }

  // Keyed on (userId, date) rather than change.id -- unlike every other synced entity, a daily
  // step count isn't something the client tracks by a stable row id it created; it's "whatever
  // today's total is right now" recomputed independently by each device. Merged via max(steps),
  // not the usual updatedAt-wins conflict check: two devices reporting the same day's count are
  // both reading the same monotonically-increasing sensor, so the larger number is always the
  // more complete one, regardless of which device's clock or sync happened to run last -- a
  // plain "newest updatedAt wins" rule would let a device that synced early in the day (small
  // count so far) overwrite a device that already reported a bigger count later that same day.
  private async applyStepCountChange(
    userId: string,
    change: StepCountSyncChangeDto,
  ): Promise<SyncChangeResult> {
    const date = this.truncateToUtcDay(change.date);
    const key = change.id;

    const existing = await this.prisma.dailyStepCount.findUnique({
      where: { userId_date: { userId, date } },
    });

    if (existing && existing.steps >= change.steps) {
      return { status: 'applied', clientKey: key, record: existing };
    }

    const data = {
      date,
      steps: change.steps,
      source: change.source ?? 'DEVICE_SENSOR',
      updatedAt: new Date(change.updatedAt),
    };

    const record = existing
      ? await this.prisma.dailyStepCount.update({ where: { id: existing.id }, data })
      : await this.prisma.dailyStepCount.create({ data: { ...data, userId } });

    return { status: 'applied', clientKey: key, record };
  }

  private truncateToUtcDay(isoDate: string): Date {
    const date = new Date(isoDate);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  // Same keyed-on-(userId, date) / max(floors)-merge reasoning as applyStepCountChange (task
  // 10.8) -- a daily floors-climbed total is recomputed independently by each device, and the
  // larger number is always the more complete one.
  private async applyFloorsClimbedChange(
    userId: string,
    change: FloorsClimbedSyncChangeDto,
  ): Promise<SyncChangeResult> {
    const date = this.truncateToUtcDay(change.date);
    const key = change.id;

    const existing = await this.prisma.dailyFloorsClimbed.findUnique({
      where: { userId_date: { userId, date } },
    });

    if (existing && existing.floors >= change.floors) {
      return { status: 'applied', clientKey: key, record: existing };
    }

    const data = {
      date,
      floors: change.floors,
      source: change.source ?? 'DEVICE_SENSOR',
      updatedAt: new Date(change.updatedAt),
    };

    const record = existing
      ? await this.prisma.dailyFloorsClimbed.update({ where: { id: existing.id }, data })
      : await this.prisma.dailyFloorsClimbed.create({ data: { ...data, userId } });

    return { status: 'applied', clientKey: key, record };
  }

  // Task 8.2. No conflict/update path at all -- a block event is immutable once logged, so the
  // only question is "have we already recorded this exact client-generated id." That makes this
  // idempotent-create the simplest apply* method in this file: no isServerNewer check, no merge.
  private async applyBlockEventChange(
    userId: string,
    change: BlockEventSyncChangeDto,
  ): Promise<SyncChangeResult> {
    const existing = await this.prisma.blockEvent.findFirst({ where: { id: change.id, userId } });
    if (existing) {
      return { status: 'skipped', clientKey: change.id };
    }

    try {
      const record = await this.prisma.blockEvent.create({
        data: {
          id: change.id,
          userId,
          identifier: change.identifier ?? null,
          scope: change.scope,
          trigger: change.trigger,
          occurredAt: new Date(change.occurredAt),
        },
      });
      return { status: 'applied', clientKey: change.id, record };
    } catch (error) {
      if (isDuplicateId(error)) return { status: 'skipped', clientKey: change.id };
      throw error;
    }
  }

  // Focus events aren't in the pull (clients only write them), but the study status export
  // (scripts/export-study-status.mjs, 2026-10-21) needs the pomodoro ratings and exits. Read-only,
  // oldest first; `since` keeps it from growing with the whole history.
  async listFocusEvents(userId: string, since: Date) {
    return this.prisma.focusEvent.findMany({
      where: { userId, occurredAt: { gte: since } },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    });
  }

  // Full attempts, texts included (the pull leaves them out): for showing a past exercise and its
  // feedback. Oldest first; without `since`, the whole history.
  async listExerciseAttempts(userId: string, since?: Date) {
    return this.prisma.exerciseAttempt.findMany({
      where: { userId, ...(since ? { occurredAt: { gte: since } } : {}) },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    });
  }

  // A graded exercise: immutable like a focus event, so an idempotent create on the client id. A
  // regrade is a new attempt that `supersedes` the old one, never an update; `supersedes` isn't
  // checked, since a correction can arrive before its original and replay ignores unknown targets.
  private async applyExerciseAttemptChange(
    userId: string,
    change: ExerciseAttemptSyncChangeDto,
  ): Promise<SyncChangeResult> {
    const existing = await this.prisma.exerciseAttempt.findFirst({
      where: { id: change.id, userId },
    });
    if (existing) {
      return { status: 'skipped', clientKey: change.id };
    }

    try {
      const record = await this.prisma.exerciseAttempt.create({
        data: {
          id: change.id,
          userId,
          exerciseId: change.exerciseId,
          exerciseSource: change.exerciseSource,
          noteCode: change.noteCode,
          section: change.section,
          b: change.b,
          r: change.r,
          hints: change.hints,
          minutes: change.minutes ?? null,
          gradedBy: change.gradedBy,
          supersedes: change.supersedes ?? null,
          generatedStatement: change.generatedStatement ?? null,
          feedback: change.feedback ?? null,
          studyTaskId: change.studyTaskId ?? null,
          pomodoroSessionId: change.pomodoroSessionId ?? null,
          occurredAt: new Date(change.occurredAt),
        },
      });
      return { status: 'applied', clientKey: change.id, record };
    } catch (error) {
      if (isDuplicateId(error)) return { status: 'skipped', clientKey: change.id };
      throw error;
    }
  }

  // Focus-block telemetry: immutable like a block event, so an idempotent create on the client id.
  private async applyFocusEventChange(
    userId: string,
    change: FocusEventSyncChangeDto,
  ): Promise<SyncChangeResult> {
    const existing = await this.prisma.focusEvent.findFirst({ where: { id: change.id, userId } });
    if (existing) {
      return { status: 'skipped', clientKey: change.id };
    }

    let record;
    try {
      record = await this.prisma.focusEvent.create({
        data: {
          id: change.id,
          userId,
          kind: change.kind,
          occurredAt: new Date(change.occurredAt),
          scheduleId: change.scheduleId ?? null,
          taskId: change.taskId ?? null,
          pomodoroSessionId: change.pomodoroSessionId ?? null,
          attentionProfile: change.attentionProfile ?? null,
          blockStartAt: change.blockStartAt ? new Date(change.blockStartAt) : null,
          value: change.value ?? null,
          meta: (change.meta ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      if (isDuplicateId(error)) return { status: 'skipped', clientKey: change.id };
      throw error;
    }

    return { status: 'applied', clientKey: change.id, record };
  }

  // Task 8.3. Keyed on (userId, date), same as applyStepCountChange/applyFloorsClimbedChange, but
  // a plain updatedAt-wins overwrite instead of their max()-merge -- screen time only ever comes
  // from one Android phone per account in practice (unlike a pedometer, there's no multi-device
  // scenario where an older sync could under-report a day that another device already reported
  // more completely), so the ordinary conflict rule every other synced entity uses is enough.
  private async applyDailyScreenTimeChange(
    userId: string,
    change: DailyScreenTimeSyncChangeDto,
  ): Promise<SyncChangeResult> {
    const date = this.truncateToUtcDay(change.date);
    const key = change.id;

    const existing = await this.prisma.dailyScreenTime.findUnique({
      where: { userId_date: { userId, date } },
    });

    if (existing && this.isServerNewer(existing.updatedAt, change.updatedAt)) {
      return { status: 'conflict', clientKey: key, server: existing };
    }

    const data = {
      date,
      totalMinutes: change.totalMinutes,
      topApps: change.topApps as unknown as Prisma.InputJsonValue,
      updatedAt: new Date(change.updatedAt),
    };

    const record = existing
      ? await this.prisma.dailyScreenTime.update({ where: { id: existing.id }, data })
      : await this.prisma.dailyScreenTime.create({ data: { ...data, userId } });

    return { status: 'applied', clientKey: key, record };
  }

  // Windows desktop counterpart of applyDailyScreenTimeChange -- same updatedAt-wins reasoning:
  // only one Windows PC per account realistically runs Steam/Riot Client/Battle.net at a time, so
  // there's no multi-device scenario needing DailyStepCount's max()-merge instead.
  private async applyDailyGameTimeChange(
    userId: string,
    change: DailyGameTimeSyncChangeDto,
  ): Promise<SyncChangeResult> {
    const date = this.truncateToUtcDay(change.date);
    const key = change.id;

    const existing = await this.prisma.dailyGameTime.findUnique({
      where: { userId_date: { userId, date } },
    });

    if (existing && this.isServerNewer(existing.updatedAt, change.updatedAt)) {
      return { status: 'conflict', clientKey: key, server: existing };
    }

    const data = {
      date,
      totalMinutes: change.totalMinutes,
      topGames: change.topGames as unknown as Prisma.InputJsonValue,
      updatedAt: new Date(change.updatedAt),
    };

    const record = existing
      ? await this.prisma.dailyGameTime.update({ where: { id: existing.id }, data })
      : await this.prisma.dailyGameTime.create({ data: { ...data, userId } });

    return { status: 'applied', clientKey: key, record };
  }

  // Same updatedAt-wins reasoning as applyDailyGameTimeChange: the rollup describes one Windows
  // PC's foreground activity, so there's no multi-device merge to do (DailyStepCount's max()-merge
  // exists because a phone and a watch both count the same steps; two PCs would be counting
  // genuinely different time, and the last writer owning the day is the honest simple answer).
  private async applyDailyDesktopAppTimeChange(
    userId: string,
    change: DailyDesktopAppTimeSyncChangeDto,
  ): Promise<SyncChangeResult> {
    const date = this.truncateToUtcDay(change.date);
    const key = change.id;

    const existing = await this.prisma.dailyDesktopAppTime.findUnique({
      where: { userId_date: { userId, date } },
    });

    if (existing && this.isServerNewer(existing.updatedAt, change.updatedAt)) {
      return { status: 'conflict', clientKey: key, server: existing };
    }

    const data = {
      date,
      totalMinutes: change.totalMinutes,
      topApps: change.topApps as unknown as Prisma.InputJsonValue,
      updatedAt: new Date(change.updatedAt),
    };

    const record = existing
      ? await this.prisma.dailyDesktopAppTime.update({ where: { id: existing.id }, data })
      : await this.prisma.dailyDesktopAppTime.create({ data: { ...data, userId } });

    return { status: 'applied', clientKey: key, record };
  }

  // Opt-in per habit (Habit.linkedFitnessActivityType) rather than fuzzy-matching titles: a
  // silent false-positive auto-complete would be worse than no auto-complete at all.
  private async autoCompleteHabitsFromFitness(
    userId: string,
    fitnessEntry: { id: string; activityType: string; loggedAt: Date },
  ): Promise<void> {
    const habits = await this.prisma.habit.findMany({
      where: {
        userId,
        deletedAt: null,
        archived: false,
        linkedFitnessActivityType: { equals: fitnessEntry.activityType, mode: 'insensitive' },
      },
    });
    if (!habits.length) return;

    const dayStart = new Date(fitnessEntry.loggedAt);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    for (const habit of habits) {
      const matchingEntries = await this.prisma.fitnessEntry.findMany({
        where: {
          userId,
          activityType: { equals: habit.linkedFitnessActivityType!, mode: 'insensitive' },
          loggedAt: { gte: dayStart, lt: dayEnd },
        },
      });
      const totalMinutes = matchingEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0);

      const existingRecord = await this.prisma.habitRecord.findUnique({
        where: { habitId_date: { habitId: habit.id, date: dayStart } },
      });

      // Don't clobber a day the user already hand-edited themselves.
      if (existingRecord && !existingRecord.autoCompleted) continue;

      await this.prisma.habitRecord.upsert({
        where: { habitId_date: { habitId: habit.id, date: dayStart } },
        create: {
          habitId: habit.id,
          userId,
          date: dayStart,
          value: totalMinutes,
          status: 'DONE',
          autoCompleted: true,
          fitnessEntryId: fitnessEntry.id,
          updatedAt: new Date(),
        },
        update: {
          value: totalMinutes,
          status: 'DONE',
          autoCompleted: true,
          fitnessEntryId: fitnessEntry.id,
          updatedAt: new Date(),
        },
      });
    }
  }

  private async applyDetoxPlanChange(
    userId: string,
    change: DetoxPlanSyncChangeDto,
  ): Promise<SyncChangeResult> {
    const existing = await this.prisma.detoxPlan.findUnique({ where: { userId } });
    const key = change.id ?? existing?.id;

    if (change.deleted) {
      if (!existing) {
        return { status: 'skipped', clientKey: key };
      }
      if (this.isServerNewer(existing.updatedAt, change.updatedAt)) {
        return { status: 'conflict', clientKey: key, server: existing };
      }
      await this.prisma.detoxPlan.delete({ where: { id: existing.id } });
      return { status: 'applied', clientKey: key, record: { id: existing.id } };
    }

    if (!change.planData || typeof change.planData !== 'object') {
      throw new BadRequestException('Detox plan changes require planData');
    }

    if (existing && this.isServerNewer(existing.updatedAt, change.updatedAt)) {
      return { status: 'conflict', clientKey: key, server: existing };
    }

    const planData = change.planData as Prisma.InputJsonValue;

    const record = existing
      ? await this.prisma.detoxPlan.update({
          where: { id: existing.id },
          data: {
            planData,
            updatedAt: new Date(change.updatedAt),
          },
        })
      : await this.prisma.detoxPlan.create({
          data: {
            userId,
            planData,
            updatedAt: new Date(change.updatedAt),
          },
        });

    return { status: 'applied', clientKey: key, record };
  }

  private async applySerotoninSessionChange(
    userId: string,
    change: SerotoninSessionSyncChangeDto,
  ): Promise<SyncChangeResult> {
    const existing = await this.prisma.serotoninSession.findUnique({ where: { userId } });
    const key = change.id ?? existing?.id;

    if (change.deleted) {
      if (!existing) {
        return { status: 'skipped', clientKey: key };
      }
      if (this.isServerNewer(existing.updatedAt, change.updatedAt)) {
        return { status: 'conflict', clientKey: key, server: existing };
      }
      await this.prisma.serotoninSession.delete({ where: { id: existing.id } });
      return { status: 'applied', clientKey: key, record: { id: existing.id } };
    }

    if (!change.sessionData || typeof change.sessionData !== 'object') {
      throw new BadRequestException('Serotonin session changes require sessionData');
    }

    if (existing && this.isServerNewer(existing.updatedAt, change.updatedAt)) {
      return { status: 'conflict', clientKey: key, server: existing };
    }

    const sessionData = change.sessionData as Prisma.InputJsonValue;

    const record = existing
      ? await this.prisma.serotoninSession.update({
          where: { id: existing.id },
          data: {
            sessionData,
            updatedAt: new Date(change.updatedAt),
          },
        })
      : await this.prisma.serotoninSession.create({
          data: {
            userId,
            sessionData,
            updatedAt: new Date(change.updatedAt),
          },
        });

    return { status: 'applied', clientKey: key, record };
  }

  private async applyHabitChange(
    userId: string,
    change: HabitSyncChangeDto,
  ): Promise<SyncChangeResult> {
    const existing = await this.findHabit(userId, change);
    const key = this.clientKey(change);

    if (change.deleted) {
      if (!existing) {
        return { status: 'skipped', clientKey: key };
      }
      if (this.isServerNewer(existing.updatedAt, change.updatedAt)) {
        return { status: 'conflict', clientKey: key, server: existing };
      }
      const record = await this.prisma.habit.update({
        where: { id: existing.id },
        data: { deletedAt: new Date(), updatedAt: new Date(change.updatedAt) },
      });
      return { status: 'applied', clientKey: key, record };
    }

    if (!change.title) {
      throw new BadRequestException('Habit changes require title');
    }

    if (existing && this.isServerNewer(existing.updatedAt, change.updatedAt)) {
      return { status: 'conflict', clientKey: key, server: existing };
    }

    const data = {
      title: change.title,
      description: change.description ?? null,
      type: change.type ?? ('NORMAL' as const),
      dailyGoalValue: change.dailyGoalValue ?? 1,
      dailyGoalUnit: change.dailyGoalUnit ?? 'times',
      dailyGoalExtraValue: change.dailyGoalExtraValue ?? null,
      targetDays: change.targetDays ?? 66,
      color: change.color ?? null,
      category: change.category ?? null,
      archived: change.archived ?? false,
      linkedFitnessActivityType: change.linkedFitnessActivityType ?? null,
      reminderStartMinute: change.reminderStartMinute ?? null,
      reminderEndMinute: change.reminderEndMinute ?? null,
      reminderDaysOfWeek: change.reminderDaysOfWeek ?? [0, 1, 2, 3, 4, 5, 6],
      clientId: change.clientId ?? existing?.clientId ?? null,
      updatedAt: new Date(change.updatedAt),
      deletedAt: null,
    };

    const record = existing
      ? await this.prisma.habit.update({ where: { id: existing.id }, data })
      : await this.prisma.habit.create({ data: { ...data, userId } });

    return { status: 'applied', clientKey: key, record };
  }

  private findHabit(userId: string, change: HabitSyncChangeDto) {
    if (change.id) {
      return this.prisma.habit.findFirst({ where: { id: change.id, userId } });
    }
    if (change.clientId) {
      return this.prisma.habit.findFirst({
        where: { userId, clientId: change.clientId },
      });
    }
    return null;
  }

  private async applyHabitRecordChange(
    userId: string,
    change: HabitRecordSyncChangeDto,
  ): Promise<SyncChangeResult> {
    const existing = await this.findHabitRecord(userId, change);
    const key = this.clientKey(change);

    if (change.deleted) {
      if (!existing) {
        return { status: 'skipped', clientKey: key };
      }
      if (this.isServerNewer(existing.updatedAt, change.updatedAt)) {
        return { status: 'conflict', clientKey: key, server: existing };
      }
      await this.prisma.habitRecord.delete({ where: { id: existing.id } });
      return { status: 'applied', clientKey: key, record: { id: existing.id } };
    }

    if (!change.habitId || !change.date) {
      throw new BadRequestException('Habit record changes require habitId and date');
    }

    if (existing && this.isServerNewer(existing.updatedAt, change.updatedAt)) {
      return { status: 'conflict', clientKey: key, server: existing };
    }

    const data = {
      habitId: change.habitId,
      date: new Date(change.date),
      value: change.value ?? 0,
      status: change.status ?? ('DONE' as const),
      autoCompleted: change.autoCompleted ?? false,
      fitnessEntryId: change.fitnessEntryId ?? null,
      clientId: change.clientId ?? existing?.clientId ?? null,
      updatedAt: new Date(change.updatedAt),
    };

    const record = existing
      ? await this.prisma.habitRecord.update({ where: { id: existing.id }, data })
      : await this.prisma.habitRecord.create({ data: { ...data, userId } });

    return { status: 'applied', clientKey: key, record };
  }

  // Idempotent by (scheduleId, date): marking the same block done twice -- from the phone and the
  // PC, or a retried offline flush -- resolves to the one row instead of tripping the unique key.
  private async applyScheduleCompletionChange(
    userId: string,
    change: ScheduleCompletionSyncChangeDto,
  ): Promise<SyncChangeResult> {
    const key = this.clientKey(change);
    const date = change.date ? new Date(change.date) : null;

    let existing = change.id
      ? await this.prisma.scheduleCompletion.findFirst({ where: { id: change.id, userId } })
      : null;
    if (!existing && change.clientId) {
      existing = await this.prisma.scheduleCompletion.findFirst({
        where: { userId, clientId: change.clientId },
      });
    }
    if (!existing && change.scheduleId && date) {
      existing = await this.prisma.scheduleCompletion.findFirst({
        where: { userId, scheduleId: change.scheduleId, date },
      });
    }

    if (change.deleted) {
      if (!existing) {
        return { status: 'skipped', clientKey: key };
      }
      await this.prisma.scheduleCompletion.delete({ where: { id: existing.id } });
      return { status: 'applied', clientKey: key, record: { id: existing.id } };
    }

    if (!change.scheduleId || !date) {
      throw new BadRequestException('Schedule completion changes require scheduleId and date');
    }
    const status = change.status ?? 'DONE';
    const reason = change.reason ?? null;
    if (existing) {
      // Same day marked again from another device: idempotent, unless it changed between done
      // and skipped (or its reason).
      if (existing.status === status && existing.reason === reason) {
        return { status: 'applied', clientKey: key, record: existing };
      }
      const record = await this.prisma.scheduleCompletion.update({
        where: { id: existing.id },
        data: { status, reason, updatedAt: new Date(change.updatedAt) },
      });
      return { status: 'applied', clientKey: key, record };
    }

    const schedule = await this.prisma.schedule.findFirst({
      where: { id: change.scheduleId, userId },
    });
    if (!schedule) {
      return { status: 'skipped', clientKey: key };
    }

    const record = await this.prisma.scheduleCompletion.create({
      data: {
        userId,
        scheduleId: change.scheduleId,
        date,
        status,
        reason,
        clientId: change.clientId ?? null,
        updatedAt: new Date(change.updatedAt),
      },
    });
    return { status: 'applied', clientKey: key, record };
  }

  // Same keying as completions: idempotent by (scheduleId, date), so the phone and the PC moving
  // the same block that day land on one row. Unlike a completion its content can change (moved
  // again, another category), so a newer server row wins.
  private async applyScheduleExceptionChange(
    userId: string,
    change: ScheduleExceptionSyncChangeDto,
  ): Promise<SyncChangeResult> {
    const key = this.clientKey(change);
    const date = change.date ? new Date(change.date) : null;

    let existing = change.id
      ? await this.prisma.scheduleException.findFirst({ where: { id: change.id, userId } })
      : null;
    if (!existing && change.clientId) {
      existing = await this.prisma.scheduleException.findFirst({
        where: { userId, clientId: change.clientId },
      });
    }
    if (!existing && change.scheduleId && date) {
      existing = await this.prisma.scheduleException.findFirst({
        where: { userId, scheduleId: change.scheduleId, date },
      });
    }

    if (change.deleted) {
      if (!existing) {
        return { status: 'skipped', clientKey: key };
      }
      if (this.isServerNewer(existing.updatedAt, change.updatedAt)) {
        return { status: 'conflict', clientKey: key, server: existing };
      }
      await this.prisma.scheduleException.delete({ where: { id: existing.id } });
      return { status: 'applied', clientKey: key, record: { id: existing.id } };
    }

    if (!change.scheduleId || !date) {
      throw new BadRequestException('Schedule exception changes require scheduleId and date');
    }
    if (existing && this.isServerNewer(existing.updatedAt, change.updatedAt)) {
      return { status: 'conflict', clientKey: key, server: existing };
    }
    const data = {
      category: change.category ?? null,
      label: change.label ?? null,
      startMinute: change.startMinute ?? null,
      endMinute: change.endMinute ?? null,
      updatedAt: new Date(change.updatedAt),
    };
    if (existing) {
      const record = await this.prisma.scheduleException.update({
        where: { id: existing.id },
        data,
      });
      return { status: 'applied', clientKey: key, record };
    }

    const schedule = await this.prisma.schedule.findFirst({
      where: { id: change.scheduleId, userId },
    });
    if (!schedule) {
      return { status: 'skipped', clientKey: key };
    }
    const record = await this.prisma.scheduleException.create({
      data: {
        ...data,
        userId,
        scheduleId: change.scheduleId,
        date,
        clientId: change.clientId ?? null,
      },
    });
    return { status: 'applied', clientKey: key, record };
  }

  // One per user, updatedAt-wins: the same handling as the detox plan.
  private async applyStudyPlanChange(
    userId: string,
    change: StudyPlanSyncChangeDto,
  ): Promise<SyncChangeResult> {
    const existing = await this.prisma.studyPlan.findUnique({ where: { userId } });
    const key = change.id ?? existing?.id;

    if (change.deleted) {
      if (!existing) {
        return { status: 'skipped', clientKey: key };
      }
      if (this.isServerNewer(existing.updatedAt, change.updatedAt)) {
        return { status: 'conflict', clientKey: key, server: existing };
      }
      await this.prisma.studyPlan.delete({ where: { id: existing.id } });
      return { status: 'applied', clientKey: key, record: { id: existing.id } };
    }

    if (!change.planData || typeof change.planData !== 'object') {
      throw new BadRequestException('Study plan changes require planData');
    }
    if (existing && this.isServerNewer(existing.updatedAt, change.updatedAt)) {
      return { status: 'conflict', clientKey: key, server: existing };
    }

    const planData = change.planData as Prisma.InputJsonValue;
    const updatedAt = new Date(change.updatedAt);
    const record = existing
      ? await this.prisma.studyPlan.update({ where: { id: existing.id }, data: { planData, updatedAt } })
      : await this.prisma.studyPlan.create({ data: { userId, planData, updatedAt } });
    return { status: 'applied', clientKey: key, record };
  }

  private async findHabitRecord(userId: string, change: HabitRecordSyncChangeDto) {
    if (change.id) {
      const byId = await this.prisma.habitRecord.findFirst({ where: { id: change.id, userId } });
      if (byId) return byId;
    }
    if (change.clientId) {
      const byClientId = await this.prisma.habitRecord.findFirst({
        where: { userId, clientId: change.clientId },
      });
      if (byClientId) return byClientId;
    }
    // habitId+date is the schema's other unique key (@@unique([habitId, date])). Every lookup
    // above can miss without meaning "no record exists for that day": a synthetic client id
    // ("pending-<habitId>-<date>", never persisted server-side), a clientId this server hasn't
    // seen (a duplicate offline check-in, or one from another device), or a real id that was
    // since deleted. Any of those would otherwise fall through to create() and die on this
    // constraint (P2002) -- which, because one throwing change fails the whole /sync/batch, would
    // stall the client's offline queue permanently on every retry. Falling back to habitId+date
    // turns all of those into an update/merge of the existing row instead. This completes the
    // partial fix from task 7.22, which only added this fallback on the clientId path.
    if (change.habitId && change.date) {
      return this.prisma.habitRecord.findFirst({
        where: { userId, habitId: change.habitId, date: new Date(change.date) },
      });
    }
    return null;
  }

  private async applyJournalEntryChange(
    userId: string,
    change: JournalEntrySyncChangeDto,
  ): Promise<SyncChangeResult> {
    const existing = await this.findJournalEntry(userId, change);
    const key = this.clientKey(change);

    if (change.deleted) {
      if (!existing) {
        return { status: 'skipped', clientKey: key };
      }
      if (this.isServerNewer(existing.updatedAt, change.updatedAt)) {
        return { status: 'conflict', clientKey: key, server: existing };
      }
      await this.prisma.journalEntry.delete({ where: { id: existing.id } });
      return { status: 'applied', clientKey: key, record: { id: existing.id } };
    }

    if (!change.habitId || !change.content) {
      throw new BadRequestException('Journal entry changes require habitId and content');
    }

    if (existing && this.isServerNewer(existing.updatedAt, change.updatedAt)) {
      return { status: 'conflict', clientKey: key, server: existing };
    }

    const data = {
      habitId: change.habitId,
      recordId: change.recordId ?? null,
      content: change.content,
      clientId: change.clientId ?? existing?.clientId ?? null,
      updatedAt: new Date(change.updatedAt),
    };

    const record = existing
      ? await this.prisma.journalEntry.update({ where: { id: existing.id }, data })
      : await this.prisma.journalEntry.create({ data: { ...data, userId } });

    return { status: 'applied', clientKey: key, record };
  }

  private findJournalEntry(userId: string, change: JournalEntrySyncChangeDto) {
    if (change.id) {
      return this.prisma.journalEntry.findFirst({ where: { id: change.id, userId } });
    }
    if (change.clientId) {
      return this.prisma.journalEntry.findFirst({
        where: { userId, clientId: change.clientId },
      });
    }
    return null;
  }
}

/**
 * The same immutable event sent twice at once (the phone's offline-queue flush racing a direct send)
 * passes the "already stored?" check twice; the second insert then hits the primary key. It's a
 * duplicate, not a failure.
 */
/** A JSON column's value for Prisma: null has to be spelled DbNull. */
function jsonOrNull(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value === null || value === undefined ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}

/**
 * A session's sequence-mode fields from a change. Fields the client didn't send (an app from before
 * 2026-10-15 pausing a block the PC started) keep the stored value; cutCount never goes down. The
 * flexible-block fields (2026-10-22) work the same way, and focusMinutes never goes down either: a
 * device that hasn't seen the last focus end mustn't undo its minutes.
 */
function sequenceSessionFields(
  change: PomodoroSyncChangeDto,
  existing: {
    blockStartAt: Date | null;
    sequence: Prisma.JsonValue | null;
    segmentIndex: number | null;
    cutCount: number;
    flexible: boolean;
    plannedBlockMin: number | null;
    windowEndAt: Date | null;
    focusMinutes: number;
  } | null,
) {
  const blockStartAt =
    change.blockStartAt === undefined ? existing?.blockStartAt : change.blockStartAt;
  const windowEndAt = change.windowEndAt;
  return {
    blockStartAt: blockStartAt ? new Date(blockStartAt) : null,
    sequence: jsonOrNull(change.sequence === undefined ? existing?.sequence : change.sequence),
    segmentIndex:
      change.segmentIndex === undefined ? (existing?.segmentIndex ?? null) : change.segmentIndex,
    cutCount: Math.max(existing?.cutCount ?? 0, change.cutCount ?? 0),
    flexible: change.flexible ?? existing?.flexible ?? false,
    plannedBlockMin:
      change.plannedBlockMin === undefined ? (existing?.plannedBlockMin ?? null) : change.plannedBlockMin,
    windowEndAt:
      windowEndAt === undefined ? (existing?.windowEndAt ?? null) : windowEndAt ? new Date(windowEndAt) : null,
    focusMinutes: Math.max(existing?.focusMinutes ?? 0, change.focusMinutes ?? 0),
  };
}

function isDuplicateId(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
