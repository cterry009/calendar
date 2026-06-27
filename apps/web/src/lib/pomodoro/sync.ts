import type { PomodoroSession } from '@calendar/shared';
import { syncBatch } from '../offline/sync-client';
import type { SyncPomodoroRecord } from './types';

export interface PomodoroSyncChangeDto {
  id?: string;
  updatedAt: string;
  deleted?: boolean;
  taskId?: string;
  state?: SyncPomodoroRecord['state'];
  focusDurationMin?: number;
  shortBreakMin?: number;
  longBreakMin?: number;
  cyclesBeforeLongBreak?: number;
  completedCycles?: number;
  active?: boolean;
  interrupted?: boolean;
  startedAt?: string;
  endedAt?: string;
}

interface SyncBatchResponse {
  applied: Record<string, unknown[] | undefined>;
  conflicts: Record<string, unknown[] | undefined>;
}

function buildPayloadFromSession(
  session: Pick<
    PomodoroSession,
    | 'taskId'
    | 'state'
    | 'focusDurationMin'
    | 'shortBreakMin'
    | 'longBreakMin'
    | 'cyclesBeforeLongBreak'
    | 'completedCycles'
    | 'active'
    | 'interrupted'
    | 'startedAt'
    | 'endedAt'
  >,
): Omit<PomodoroSyncChangeDto, 'id' | 'updatedAt'> {
  return {
    taskId: session.taskId ?? undefined,
    state: session.state,
    focusDurationMin: session.focusDurationMin,
    shortBreakMin: session.shortBreakMin,
    longBreakMin: session.longBreakMin,
    cyclesBeforeLongBreak: session.cyclesBeforeLongBreak,
    completedCycles: session.completedCycles,
    active: session.active,
    interrupted: session.interrupted,
    startedAt: session.startedAt ?? undefined,
    endedAt: session.endedAt ?? undefined,
  };
}

export async function syncPomodoroBatch(changes: PomodoroSyncChangeDto[]): Promise<SyncBatchResponse> {
  if (!changes.length) {
    return { applied: {}, conflicts: {} };
  }

  return syncBatch({ pomodoroSessions: changes });
}

export function buildCreatePomodoroPayload(session: SyncPomodoroRecord): PomodoroSyncChangeDto {
  return {
    id: session.id,
    updatedAt: new Date().toISOString(),
    ...buildPayloadFromSession(session),
  };
}

export function buildUpdatePomodoroPayload(session: SyncPomodoroRecord): PomodoroSyncChangeDto {
  return {
    id: session.id,
    updatedAt: new Date().toISOString(),
    ...buildPayloadFromSession(session),
  };
}
