import type { FitnessSource } from '@calendar/shared';
import { syncBatch, type SyncBatchResponse } from '../sync/api';

export interface FloorsClimbedSyncChangeDto {
  date: string;
  floors: number;
  updatedAt: string;
  source?: FitnessSource;
}

export async function syncFloorsClimbedBatch(change: FloorsClimbedSyncChangeDto): Promise<SyncBatchResponse> {
  return syncBatch({ dailyFloorsClimbed: [change] });
}

// `date` is today at UTC midnight -- same reasoning as steps/api.ts's buildStepCountPayload.
export function buildFloorsClimbedPayload(floors: number): FloorsClimbedSyncChangeDto {
  const now = new Date();
  const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  return {
    date: utcMidnight.toISOString(),
    floors,
    updatedAt: now.toISOString(),
    source: 'DEVICE_SENSOR',
  };
}
