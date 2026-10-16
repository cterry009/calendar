import type { SequenceSegment } from '@calendar/shared';
import { syncBatch, type SyncBatchResponse } from '../sync/api';
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
  reviewedCycles?: number;
  blockStartAt?: string | null;
  sequence?: SequenceSegment[] | null;
  segmentIndex?: number | null;
  cutCount?: number;
}

function buildPayloadFromSession(
  session: Pick<
    SyncPomodoroRecord,
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
    | 'reviewedCycles'
    | 'blockStartAt'
    | 'sequence'
    | 'segmentIndex'
    | 'cutCount'
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
    reviewedCycles: session.reviewedCycles ?? 0,
    blockStartAt: session.blockStartAt ?? null,
    sequence: session.sequence ?? null,
    segmentIndex: session.segmentIndex ?? null,
    cutCount: session.cutCount ?? 0,
  };
}

export async function syncPomodoroBatch(changes: PomodoroSyncChangeDto[]): Promise<SyncBatchResponse> {
  if (!changes.length) {
    return { applied: {}, conflicts: {} };
  }

  return syncBatch({ pomodoroSessions: changes });
}

export function buildPomodoroPayload(session: SyncPomodoroRecord): PomodoroSyncChangeDto {
  return {
    id: session.id,
    updatedAt: new Date().toISOString(),
    ...buildPayloadFromSession(session),
  };
}
