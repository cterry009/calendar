export type SyncEntityType =
  | 'tasks'
  | 'schedules'
  | 'pomodoroSessions'
  | 'blockListEntries'
  | 'fitnessEntries'
  | 'detoxPlan'
  | 'serotoninSession'
  | 'habits'
  | 'habitRecords'
  | 'journalEntries';

export interface SyncChangeResult<T = unknown> {
  status: 'applied' | 'conflict' | 'skipped';
  clientKey?: string;
  record?: T;
  server?: T;
}

export interface SyncBatchResult {
  applied: Partial<Record<SyncEntityType, SyncChangeResult[]>>;
  conflicts: Partial<Record<SyncEntityType, SyncChangeResult[]>>;
}

export interface SyncEventPayload {
  sourceDeviceId: string;
  entities: SyncEntityType[];
  timestamp: string;
}
