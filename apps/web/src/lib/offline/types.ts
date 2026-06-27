import type { SyncSnapshot } from '../calendar/types';

export type SyncEntityType =
  | 'tasks'
  | 'schedules'
  | 'pomodoroSessions'
  | 'blockListEntries'
  | 'fitnessEntries';

export interface SyncQueueItem {
  id?: number;
  entity: SyncEntityType;
  payload: unknown[];
  createdAt: string;
}

export interface PullSnapshotResult {
  snapshot: SyncSnapshot;
  fromCache: boolean;
}

export interface SyncBatchBody {
  tasks?: unknown[];
  schedules?: unknown[];
  pomodoroSessions?: unknown[];
  blockListEntries?: unknown[];
  fitnessEntries?: unknown[];
}

export interface SyncBatchResponse {
  applied: Record<string, unknown[] | undefined>;
  conflicts: Record<string, unknown[] | undefined>;
}

export const SNAPSHOT_CACHE_KEY = 'latest';
