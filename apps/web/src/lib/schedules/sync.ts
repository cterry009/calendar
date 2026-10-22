import type { SequenceSegment } from '@calendar/shared';
import { syncBatch } from '../offline/sync-client';
import type { ScheduleFormValues, SyncScheduleRecord } from './types';

export interface ScheduleSyncChangeDto {
  id?: string;
  updatedAt: string;
  deleted?: boolean;
  kind?: ScheduleFormValues['kind'];
  daysOfWeek?: number[];
  startMinute?: number;
  endMinute?: number;
  label?: string;
  enabled?: boolean;
  pomodoroMin?: number;
  shortBreakMin?: number;
  longBreakMin?: number;
  pomodorosPerChunk?: number;
  chunks?: number;
  category?: string | null;
  sequence?: SequenceSegment[] | null;
  flexibleBlocks?: number | null;
}

interface SyncBatchResponse {
  applied: Record<string, unknown[] | undefined>;
  conflicts: Record<string, unknown[] | undefined>;
}

function buildUpsertPayload(values: ScheduleFormValues): Omit<ScheduleSyncChangeDto, 'id' | 'updatedAt'> {
  return {
    kind: values.kind,
    daysOfWeek: values.daysOfWeek,
    startMinute: values.startMinute,
    endMinute: values.endMinute,
    label: values.label?.trim() || undefined,
    enabled: values.enabled,
    pomodoroMin: values.pomodoroMin ?? undefined,
    shortBreakMin: values.shortBreakMin ?? undefined,
    longBreakMin: values.longBreakMin ?? undefined,
    pomodorosPerChunk: values.pomodorosPerChunk ?? undefined,
    chunks: values.chunks ?? undefined,
    // Only when the form set them: otherwise the block keeps what it has.
    ...(values.category !== undefined ? { category: values.category } : {}),
    ...(values.sequence !== undefined ? { sequence: values.sequence } : {}),
    ...(values.flexibleBlocks !== undefined ? { flexibleBlocks: values.flexibleBlocks } : {}),
  };
}

export async function syncScheduleBatch(changes: ScheduleSyncChangeDto[]): Promise<SyncBatchResponse> {
  if (!changes.length) {
    return { applied: {}, conflicts: {} };
  }

  return syncBatch({ schedules: changes });
}

export function buildCreateSchedulePayload(values: ScheduleFormValues): ScheduleSyncChangeDto {
  return {
    updatedAt: new Date().toISOString(),
    ...buildUpsertPayload(values),
  };
}

export function buildUpdateSchedulePayload(scheduleId: string, values: ScheduleFormValues): ScheduleSyncChangeDto {
  return {
    id: scheduleId,
    updatedAt: new Date().toISOString(),
    ...buildUpsertPayload(values),
  };
}

export function buildDeleteSchedulePayload(scheduleId: string): ScheduleSyncChangeDto {
  return {
    id: scheduleId,
    deleted: true,
    updatedAt: new Date().toISOString(),
  };
}

export function mapSyncSchedule(schedule: SyncScheduleRecord): ScheduleFormValues {
  return {
    kind: schedule.kind,
    daysOfWeek: schedule.daysOfWeek,
    startMinute: schedule.startMinute,
    endMinute: schedule.endMinute,
    label: schedule.label,
    enabled: schedule.enabled,
    pomodoroMin: schedule.pomodoroMin,
    shortBreakMin: schedule.shortBreakMin,
    longBreakMin: schedule.longBreakMin,
    pomodorosPerChunk: schedule.pomodorosPerChunk,
    chunks: schedule.chunks,
  };
}
