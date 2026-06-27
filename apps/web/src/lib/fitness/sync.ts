import type { FitnessIntensity, FitnessSource } from '@calendar/shared';
import { syncBatch } from '../offline/sync-client';
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

interface SyncBatchResponse {
  applied: Record<string, unknown[] | undefined>;
  conflicts: Record<string, unknown[] | undefined>;
}

function buildUpsertPayload(
  values: FitnessFormValues,
): Omit<FitnessSyncChangeDto, 'id' | 'updatedAt' | 'deleted'> {
  return {
    activityType: values.activityType.trim(),
    durationMinutes: values.durationMinutes,
    intensity: values.intensity,
    notes: values.notes?.trim() || undefined,
    loggedAt: values.loggedAt,
    source: 'MANUAL',
  };
}

export async function syncFitnessBatch(changes: FitnessSyncChangeDto[]): Promise<SyncBatchResponse> {
  if (!changes.length) {
    return { applied: {}, conflicts: {} };
  }

  return syncBatch({ fitnessEntries: changes });
}

export function buildCreateFitnessPayload(values: FitnessFormValues): FitnessSyncChangeDto {
  return {
    updatedAt: new Date().toISOString(),
    ...buildUpsertPayload(values),
  };
}

export function buildUpdateFitnessPayload(
  fitnessId: string,
  values: FitnessFormValues,
): FitnessSyncChangeDto {
  return {
    id: fitnessId,
    updatedAt: new Date().toISOString(),
    ...buildUpsertPayload(values),
  };
}

export function buildDeleteFitnessPayload(fitnessId: string): FitnessSyncChangeDto {
  return {
    id: fitnessId,
    deleted: true,
    updatedAt: new Date().toISOString(),
  };
}
