import type { DetoxPlan } from '@calendar/shared';
import { syncBatch } from '../offline/sync-client';

export interface DetoxPlanSyncChangeDto {
  id?: string;
  updatedAt: string;
  deleted?: boolean;
  planData?: DetoxPlan;
}

interface SyncBatchResponse {
  applied: Record<string, unknown[] | undefined>;
  conflicts: Record<string, unknown[] | undefined>;
}

export async function syncDetoxBatch(changes: DetoxPlanSyncChangeDto[]): Promise<SyncBatchResponse> {
  if (!changes.length) {
    return { applied: {}, conflicts: {} };
  }

  return syncBatch({ detoxPlan: changes });
}

export function buildUpsertDetoxPayload(
  plan: DetoxPlan,
  serverRecordId?: string | null,
): DetoxPlanSyncChangeDto {
  return {
    id: serverRecordId ?? undefined,
    updatedAt: new Date().toISOString(),
    planData: plan,
  };
}

export function buildDeleteDetoxPayload(serverRecordId: string): DetoxPlanSyncChangeDto {
  return {
    id: serverRecordId,
    deleted: true,
    updatedAt: new Date().toISOString(),
  };
}
