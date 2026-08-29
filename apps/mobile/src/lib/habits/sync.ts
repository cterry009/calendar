import * as Crypto from 'expo-crypto';
import type { HabitRecordStatus, HabitType } from '@calendar/shared';
import { syncBatch, type SyncBatchResponse } from '../sync/api';
import type { HabitCheckInValues, HabitFormValues } from './types';

// Mirrors apps/web/src/lib/habits/sync.ts's payload builders, posted through mobile's own
// offline-aware syncBatch (lib/sync/api.ts) instead of web's lib/offline/sync-client.ts. Keeps
// web's clientId-on-create pattern (via expo-crypto's Crypto.randomUUID(), the same source
// PomodoroContext.tsx already uses) rather than blocklist/sync.ts's server-generated-id-only
// style -- habit creation is more likely to happen while offline (e.g. setting up the daily
// habit templates during onboarding) and clientId is what lets a queued create survive a retry
// without becoming a duplicate.
export interface HabitSyncChangeDto {
  id?: string;
  clientId?: string;
  updatedAt: string;
  deleted?: boolean;
  title?: string;
  description?: string;
  type?: HabitType;
  dailyGoalValue?: number;
  dailyGoalUnit?: string;
  dailyGoalExtraValue?: number;
  targetDays?: number;
  color?: string;
  category?: string;
  archived?: boolean;
  linkedFitnessActivityType?: string;
  reminderStartMinute?: number;
  reminderEndMinute?: number;
  reminderDaysOfWeek?: number[];
}

export interface HabitRecordSyncChangeDto {
  id?: string;
  clientId?: string;
  updatedAt: string;
  deleted?: boolean;
  habitId?: string;
  date?: string;
  value?: number;
  status?: HabitRecordStatus;
}

function buildHabitUpsertPayload(values: HabitFormValues): Omit<HabitSyncChangeDto, 'id' | 'clientId' | 'updatedAt'> {
  return {
    title: values.title.trim(),
    description: values.description?.trim() || undefined,
    type: values.type,
    dailyGoalValue: values.dailyGoalValue,
    dailyGoalUnit: values.dailyGoalUnit.trim() || 'veces',
    dailyGoalExtraValue: values.dailyGoalExtraValue ?? undefined,
    targetDays: values.targetDays,
    color: values.color ?? undefined,
    category: values.category?.trim() || undefined,
    linkedFitnessActivityType: values.linkedFitnessActivityType?.trim() || undefined,
    reminderStartMinute: values.reminderStartMinute ?? undefined,
    reminderEndMinute: values.reminderEndMinute ?? undefined,
    reminderDaysOfWeek: values.reminderDaysOfWeek,
  };
}

export async function syncHabitBatch(changes: HabitSyncChangeDto[]): Promise<SyncBatchResponse> {
  if (!changes.length) return { applied: {}, conflicts: {} };
  return syncBatch({ habits: changes });
}

export function buildCreateHabitPayload(values: HabitFormValues): HabitSyncChangeDto {
  return {
    clientId: Crypto.randomUUID(),
    updatedAt: new Date().toISOString(),
    ...buildHabitUpsertPayload(values),
  };
}

export function buildArchiveHabitPayload(habitId: string, archived: boolean): HabitSyncChangeDto {
  return {
    id: habitId,
    updatedAt: new Date().toISOString(),
    archived,
  };
}

export function buildDeleteHabitPayload(habitId: string): HabitSyncChangeDto {
  return {
    id: habitId,
    deleted: true,
    updatedAt: new Date().toISOString(),
  };
}

export async function syncHabitRecordBatch(changes: HabitRecordSyncChangeDto[]): Promise<SyncBatchResponse> {
  if (!changes.length) return { applied: {}, conflicts: {} };
  return syncBatch({ habitRecords: changes });
}

export function buildCheckInPayload(
  habitId: string,
  values: HabitCheckInValues,
  existingId?: string,
): HabitRecordSyncChangeDto {
  return {
    id: existingId,
    clientId: existingId ? undefined : Crypto.randomUUID(),
    updatedAt: new Date().toISOString(),
    habitId,
    date: values.date,
    value: values.value,
    status: values.status,
  };
}
