import type { FitnessSource } from '@calendar/shared';
import { syncBatch, type SyncBatchResponse } from '../sync/api';

export interface StepCountSyncChangeDto {
  date: string;
  steps: number;
  updatedAt: string;
  source?: FitnessSource;
}

export async function syncStepCountBatch(change: StepCountSyncChangeDto): Promise<SyncBatchResponse> {
  return syncBatch({ dailyStepCounts: [change] });
}

// `date` is today at UTC midnight -- the server truncates to day-precision too (see
// SyncService.truncateToUtcDay), this just avoids sending a timestamp that could round to the
// wrong day at the boundary.
export function buildStepCountPayload(steps: number): StepCountSyncChangeDto {
  const now = new Date();
  const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  return {
    date: utcMidnight.toISOString(),
    steps,
    updatedAt: now.toISOString(),
    source: 'DEVICE_SENSOR',
  };
}
