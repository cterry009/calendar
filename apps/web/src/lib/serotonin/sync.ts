import type { StoredSerotoninDay } from '../calendar/types';
import { syncBatch } from '../offline/sync-client';

export interface SerotoninSessionSyncChangeDto {
  id?: string;
  updatedAt: string;
  deleted?: boolean;
  sessionData?: StoredSerotoninDay;
}

interface SyncBatchResponse {
  applied: Record<string, unknown[] | undefined>;
  conflicts: Record<string, unknown[] | undefined>;
}

export async function syncSerotoninSessionBatch(
  changes: SerotoninSessionSyncChangeDto[],
): Promise<SyncBatchResponse> {
  if (!changes.length) {
    return { applied: {}, conflicts: {} };
  }

  return syncBatch({ serotoninSession: changes });
}

export function buildUpsertSerotoninSessionPayload(
  day: StoredSerotoninDay,
  serverRecordId?: string | null,
): SerotoninSessionSyncChangeDto {
  return {
    id: serverRecordId ?? undefined,
    updatedAt: new Date().toISOString(),
    sessionData: day,
  };
}
