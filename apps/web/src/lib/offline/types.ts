import type { SyncSnapshot } from '../calendar/types';

export type SyncEntityType =
  | 'tasks'
  | 'schedules'
  | 'pomodoroSessions'
  | 'blockListEntries'
  | 'focusTriggers'
  | 'fitnessEntries'
  | 'detoxPlan'
  | 'serotoninSession'
  | 'habits'
  | 'habitRecords'
  | 'journalEntries';

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
  focusTriggers?: unknown[];
  fitnessEntries?: unknown[];
  detoxPlan?: unknown[];
  serotoninSession?: unknown[];
  habits?: unknown[];
  habitRecords?: unknown[];
  journalEntries?: unknown[];
}

export interface SyncBatchResponse {
  applied: Record<string, unknown[] | undefined>;
  conflicts: Record<string, unknown[] | undefined>;
}

export const SNAPSHOT_CACHE_KEY = 'latest';
