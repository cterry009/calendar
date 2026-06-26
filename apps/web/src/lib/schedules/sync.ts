import { apiFetch } from '../api';
import type { ScheduleFormValues, SyncScheduleRecord } from './types';

export interface ScheduleSyncChangeDto {
  id?: string;
  updatedAt: string;
  deleted?: boolean;
  kind?: ScheduleFormValues['kind'];
  dayOfWeek?: number;
  startMinute?: number;
  endMinute?: number;
  label?: string;
  enabled?: boolean;
}

interface SyncBatchResponse {
  applied: Record<string, unknown[] | undefined>;
  conflicts: Record<string, unknown[] | undefined>;
}

function buildUpsertPayload(values: ScheduleFormValues): Omit<ScheduleSyncChangeDto, 'id' | 'updatedAt'> {
  return {
    kind: values.kind,
    dayOfWeek: values.dayOfWeek,
    startMinute: values.startMinute,
    endMinute: values.endMinute,
    label: values.label?.trim() || undefined,
    enabled: values.enabled,
  };
}

export async function syncScheduleBatch(changes: ScheduleSyncChangeDto[]): Promise<SyncBatchResponse> {
  if (!changes.length) {
    return { applied: {}, conflicts: {} };
  }

  return apiFetch<SyncBatchResponse>('/sync/batch', {
    method: 'POST',
    body: JSON.stringify({ schedules: changes }),
  });
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
    dayOfWeek: schedule.dayOfWeek,
    startMinute: schedule.startMinute,
    endMinute: schedule.endMinute,
    label: schedule.label,
    enabled: schedule.enabled,
  };
}
