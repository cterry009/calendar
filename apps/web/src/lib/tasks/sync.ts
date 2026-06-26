import type { TaskStatus } from '@calendar/shared';
import { apiFetch } from '../api';
import type { SyncTaskRecord, TaskFormValues } from './types';

export interface TaskSyncChangeDto {
  id?: string;
  clientId?: string;
  updatedAt: string;
  deleted?: boolean;
  title?: string;
  description?: string;
  scheduledAt?: string;
  estimatedMinutes?: number;
  actualMinutes?: number;
  difficulty?: TaskFormValues['difficulty'];
  complexity?: number;
  priority?: TaskFormValues['priority'];
  category?: string;
  status?: TaskStatus;
  completedAt?: string;
}

interface SyncBatchResponse {
  applied: Record<string, unknown[] | undefined>;
  conflicts: Record<string, unknown[] | undefined>;
}

function buildUpsertPayload(values: TaskFormValues): Omit<TaskSyncChangeDto, 'id' | 'clientId' | 'updatedAt'> {
  return {
    title: values.title.trim(),
    description: values.description?.trim() || undefined,
    scheduledAt: values.scheduledAt || undefined,
    estimatedMinutes: values.estimatedMinutes,
    actualMinutes: values.actualMinutes ?? undefined,
    difficulty: values.difficulty,
    complexity: values.complexity,
    priority: values.priority,
    category: values.category?.trim() || undefined,
    status: values.status,
    completedAt: values.status === 'COMPLETED' ? new Date().toISOString() : undefined,
  };
}

export async function syncTaskBatch(changes: TaskSyncChangeDto[]): Promise<SyncBatchResponse> {
  if (!changes.length) {
    return { applied: {}, conflicts: {} };
  }

  return apiFetch<SyncBatchResponse>('/sync/batch', {
    method: 'POST',
    body: JSON.stringify({ tasks: changes }),
  });
}

export function buildCreateTaskPayload(values: TaskFormValues): TaskSyncChangeDto {
  return {
    clientId: crypto.randomUUID(),
    updatedAt: new Date().toISOString(),
    ...buildUpsertPayload(values),
  };
}

export function buildUpdateTaskPayload(taskId: string, values: TaskFormValues): TaskSyncChangeDto {
  return {
    id: taskId,
    updatedAt: new Date().toISOString(),
    ...buildUpsertPayload(values),
  };
}

export function buildDeleteTaskPayload(taskId: string): TaskSyncChangeDto {
  return {
    id: taskId,
    deleted: true,
    updatedAt: new Date().toISOString(),
  };
}

export function buildCompleteTaskPayload(
  task: SyncTaskRecord,
  actualMinutes: number,
): TaskSyncChangeDto {
  return {
    id: task.id,
    updatedAt: new Date().toISOString(),
    title: task.title,
    description: task.description ?? undefined,
    scheduledAt: task.scheduledAt ?? undefined,
    estimatedMinutes: task.estimatedMinutes,
    difficulty: task.difficulty,
    complexity: task.complexity,
    priority: task.priority,
    category: task.category ?? undefined,
    status: 'COMPLETED',
    actualMinutes,
    completedAt: new Date().toISOString(),
  };
}
