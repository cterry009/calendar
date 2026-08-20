import type { FitnessIntensity, FitnessSource } from '@calendar/shared';
import { syncBatch, type SyncBatchResponse } from '../sync/api';
import type { FitnessFormValues } from './types';

export interface FitnessSyncChangeDto {
  id?: string;
  updatedAt: string;
  deleted?: boolean;
  activityType?: string;
  durationMinutes?: number;
  intensity?: FitnessIntensity;
  notes?: string;
  loggedAt?: string;
  source?: FitnessSource;
  externalId?: string;
}

export async function syncFitnessBatch(changes: FitnessSyncChangeDto[]): Promise<SyncBatchResponse> {
  if (!changes.length) {
    return { applied: {}, conflicts: {} };
  }

  return syncBatch({ fitnessEntries: changes });
}

// loggedAt isn't collected in the form on this pass (no native date/time picker ported yet --
// see design.md) -- every entry logs as happening now, matching the form's own default when the
// web version is left untouched.
export function buildCreateFitnessPayload(values: FitnessFormValues): FitnessSyncChangeDto {
  return {
    updatedAt: new Date().toISOString(),
    activityType: values.activityType.trim(),
    durationMinutes: values.durationMinutes,
    intensity: values.intensity,
    notes: values.notes?.trim() || undefined,
    loggedAt: new Date().toISOString(),
    source: 'MANUAL',
  };
}

export function buildDeleteFitnessPayload(fitnessId: string): FitnessSyncChangeDto {
  return {
    id: fitnessId,
    deleted: true,
    updatedAt: new Date().toISOString(),
  };
}
