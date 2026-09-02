import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SyncEventsService } from '../realtime/sync-events.service';
import {
  BlockListSyncChangeDto,
  DetoxPlanSyncChangeDto,
  FitnessSyncChangeDto,
  FloorsClimbedSyncChangeDto,
  FocusTriggerSyncChangeDto,
  HabitRecordSyncChangeDto,
  HabitSyncChangeDto,
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
      detoxPlan,
      serotoninSession,
      habits,
      habitRecords,
      journalEntries,
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
      this.prisma.detoxPlan.findUnique({ where: { userId } }),
      this.prisma.serotoninSession.findUnique({ where: { userId } }),
      this.prisma.habit.findMany({ where: { userId, deletedAt: null } }),
      this.prisma.habitRecord.findMany({ where: { userId } }),
      this.prisma.journalEntry.findMany({ where: { userId } }),
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
      habits,
      habitRecords,
      journalEntries,
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

  private bucketResult(
    result: SyncBatchResult,
    entity: SyncEntityType,
    outcome: SyncChangeResult,
  ) {
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
      updatedAt: new Date(change.updatedAt),
    };

    const record = existing
      ? await this.prisma.pomodoroSession.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.pomodoroSession.create({
          data: {
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
      throw new BadRequestException(
        'Block list changes require kind, identifier, and label',
      );
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
      scope: change.scope ?? existing?.scope ?? 'FOCUS' as const,
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
    if (change.kind === 'LOCATION' && (change.latitude == null || change.longitude == null || change.radiusMeters == null)) {
      throw new BadRequestException('Location triggers require latitude, longitude, and radiusMeters');
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
      type: change.type ?? 'NORMAL' as const,
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
      status: change.status ?? 'DONE' as const,
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

  private findHabitRecord(userId: string, change: HabitRecordSyncChangeDto) {
    if (change.id) {
      return this.prisma.habitRecord.findFirst({ where: { id: change.id, userId } });
    }
    if (change.clientId) {
      const byClientId = this.prisma.habitRecord.findFirst({
        where: { userId, clientId: change.clientId },
      });
      // habitId+date is the schema's other unique key (@@unique([habitId, date])) -- a clientId
      // miss doesn't mean no record exists for that day, just that this particular offline-
      // generated id hasn't been seen before. Two different clientIds queued for the same
      // habit+day (e.g. a duplicate offline check-in) would otherwise both fall through to
      // create() below and the second one dies on that constraint instead of merging into the
      // first, which is exactly the case this fallback catches.
      if (change.habitId && change.date) {
        return byClientId.then(
          (record) => record ?? this.prisma.habitRecord.findFirst({ where: { userId, habitId: change.habitId, date: new Date(change.date!) } }),
        );
      }
      return byClientId;
    }
    if (change.habitId && change.date) {
      return this.prisma.habitRecord.findFirst({ where: { userId, habitId: change.habitId, date: new Date(change.date) } });
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
