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
  blockEndAt?: string | null;
  attentionProfile?: SyncPomodoroRecord['attentionProfile'];
  scheduleId?: string | null;
  pausedAt?: string | null;
  exitCount?: number;
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
    | 'blockEndAt'
    | 'attentionProfile'
    | 'scheduleId'
    | 'pausedAt'
    | 'exitCount'
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
    blockEndAt: session.blockEndAt ?? null,
    attentionProfile: session.attentionProfile ?? null,
    scheduleId: session.scheduleId ?? null,
    pausedAt: session.pausedAt ?? null,
    exitCount: session.exitCount ?? 0,
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
