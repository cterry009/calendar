import type { TaskDifficulty, TaskPriority, TaskStatus } from '@calendar/shared';
import { apiFetch } from '../auth/api';
import type { SyncSnapshot, SyncTaskRecord } from './types';

// No offline cache / WebSocket layer yet (that's task 6.3) -- this pulls the full snapshot
// straight from the server every time, same endpoint apps/web's IndexedDB-backed sync client
// wraps (server/src/sync/sync.controller.ts), just without the cache-when-offline fallback.
export async function pullSnapshot(): Promise<SyncSnapshot> {
  return apiFetch<SyncSnapshot>('/sync/pull');
}

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

interface SyncBatchResponse {
  applied: Record<string, unknown[] | undefined>;
  conflicts: Record<string, unknown[] | undefined>;
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
