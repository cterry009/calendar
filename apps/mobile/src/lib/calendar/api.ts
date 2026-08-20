import type { TaskDifficulty, TaskPriority, TaskStatus } from '@calendar/shared';
import { pullSnapshot, syncBatch, type SyncBatchResponse } from '../sync/api';
import type { SyncTaskRecord } from './types';

export { pullSnapshot };

export interface TaskSyncChangeDto {
  id?: string;
  clientId?: string;
  updatedAt: string;
  deleted?: boolean;
  title?: string;
  description?: string;
  scheduledAt?: string;
  estimatedMinutes?: number;
  estimatedPomodoros?: number;
  actualMinutes?: number;
  difficulty?: TaskDifficulty;
  complexity?: number;
  priority?: TaskPriority;
  category?: string;
  status?: TaskStatus;
  completedAt?: string;
}

export async function syncTaskBatch(changes: TaskSyncChangeDto[]): Promise<SyncBatchResponse> {
  if (!changes.length) {
    return { applied: {}, conflicts: {} };
  }

  return syncBatch({ tasks: changes });
}

export function buildCompleteTaskPayload(task: SyncTaskRecord, actualMinutes: number): TaskSyncChangeDto {
  return {
    id: task.id,
    updatedAt: new Date().toISOString(),
    title: task.title,
    description: task.description ?? undefined,
    scheduledAt: task.scheduledAt ?? undefined,
    estimatedMinutes: task.estimatedMinutes,
    estimatedPomodoros: task.estimatedPomodoros ?? undefined,
    difficulty: task.difficulty,
    complexity: task.complexity,
    priority: task.priority,
    category: task.category ?? undefined,
    status: 'COMPLETED',
    actualMinutes,
    completedAt: new Date().toISOString(),
  };
}
