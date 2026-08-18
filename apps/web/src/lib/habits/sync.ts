import type { HabitRecordStatus, HabitType } from '@calendar/shared';
import { syncBatch } from '../offline/sync-client';
import type { HabitCheckInValues, HabitFormValues } from './types';

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
  autoCompleted?: boolean;
  fitnessEntryId?: string;
}

export interface JournalEntrySyncChangeDto {
  id?: string;
  clientId?: string;
  updatedAt: string;
  deleted?: boolean;
  habitId?: string;
  recordId?: string;
  content?: string;
}

interface SyncBatchResponse {
  applied: Record<string, unknown[] | undefined>;
  conflicts: Record<string, unknown[] | undefined>;
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
  };
}

export async function syncHabitBatch(changes: HabitSyncChangeDto[]): Promise<SyncBatchResponse> {
  if (!changes.length) return { applied: {}, conflicts: {} };
  return syncBatch({ habits: changes });
}

export function buildCreateHabitPayload(values: HabitFormValues): HabitSyncChangeDto {
  return {
    clientId: crypto.randomUUID(),
    updatedAt: new Date().toISOString(),
    ...buildHabitUpsertPayload(values),
  };
}

export function buildUpdateHabitPayload(habitId: string, values: HabitFormValues): HabitSyncChangeDto {
  return {
    id: habitId,
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

export async function syncHabitRecordBatch(
  changes: HabitRecordSyncChangeDto[],
): Promise<SyncBatchResponse> {
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
    clientId: existingId ? undefined : crypto.randomUUID(),
    updatedAt: new Date().toISOString(),
    habitId,
    date: values.date,
    value: values.value,
    status: values.status,
  };
}

export function buildDeleteCheckInPayload(recordId: string): HabitRecordSyncChangeDto {
  return {
    id: recordId,
    deleted: true,
    updatedAt: new Date().toISOString(),
  };
}

export async function syncJournalEntryBatch(
  changes: JournalEntrySyncChangeDto[],
): Promise<SyncBatchResponse> {
  if (!changes.length) return { applied: {}, conflicts: {} };
  return syncBatch({ journalEntries: changes });
}

export function buildCreateJournalEntryPayload(
  habitId: string,
  content: string,
  recordId?: string,
): JournalEntrySyncChangeDto {
  return {
    clientId: crypto.randomUUID(),
    updatedAt: new Date().toISOString(),
    habitId,
    recordId,
    content: content.trim(),
  };
}

export function buildUpdateJournalEntryPayload(entryId: string, content: string): JournalEntrySyncChangeDto {
  return {
    id: entryId,
    updatedAt: new Date().toISOString(),
    content: content.trim(),
  };
}

export function buildDeleteJournalEntryPayload(entryId: string): JournalEntrySyncChangeDto {
  return {
    id: entryId,
    deleted: true,
    updatedAt: new Date().toISOString(),
  };
}
