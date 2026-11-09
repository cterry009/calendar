export type SyncEntityType =
  | 'tasks'
  | 'schedules'
  | 'pomodoroSessions'
  | 'blockListEntries'
  | 'focusTriggers'
  | 'fitnessEntries'
  | 'dailyStepCounts'
  | 'dailyFloorsClimbed'
  | 'detoxPlan'
  | 'serotoninSession'
  | 'habits'
  | 'habitRecords'
  | 'scheduleCompletions'
  | 'scheduleExceptions'
  | 'studyPlan'
  | 'journalEntries'
  | 'blockEvents'
  | 'focusEvents'
  | 'exerciseAttempts'
  | 'dailyScreenTime'
  | 'dailyGameTime'
  | 'dailyDesktopAppTime'
  | 'projects'
  | 'projectLogEntries';

export interface SyncChangeResult<T = unknown> {
  status: 'applied' | 'conflict' | 'skipped';
  clientKey?: string;
  record?: T;
  server?: T | null;
  /**
   * Why a conflict isn't the usual "the server is newer" (weekend-mode): 'commitment' (the block
   * commitment refuses weakening the night block), 'weekend-activity-cap' (3 a day).
   */
  reason?: 'commitment' | 'weekend-activity-cap';
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
