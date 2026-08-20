import { syncBatch, type SyncBatchResponse } from '../sync/api';
import type { BlockListFormValues } from './types';

// Mirrors apps/web/src/lib/blocklist/sync.ts's payload builders, posted through mobile's own
// offline-aware syncBatch (lib/sync/api.ts) instead of web's lib/offline/sync-client.ts.
export interface BlockListSyncChangeDto {
  id?: string;
  updatedAt: string;
  deleted?: boolean;
  kind?: BlockListFormValues['kind'];
  identifier?: string;
  label?: string;
  platform?: BlockListFormValues['platform'];
  highDopamine?: boolean;
  enabled?: boolean;
  hardMode?: boolean;
}

function buildUpsertPayload(values: BlockListFormValues): Omit<BlockListSyncChangeDto, 'id' | 'updatedAt'> {
  return {
    kind: values.kind,
    identifier: values.identifier.trim(),
    label: values.label.trim(),
    platform: values.platform,
    highDopamine: values.highDopamine,
    enabled: values.enabled,
    hardMode: values.hardMode,
  };
}

export async function syncBlockListBatch(changes: BlockListSyncChangeDto[]): Promise<SyncBatchResponse> {
  if (!changes.length) {
    return { applied: {}, conflicts: {} };
  }

  return syncBatch({ blockListEntries: changes });
}

export function buildCreateBlockListPayload(values: BlockListFormValues): BlockListSyncChangeDto {
  return {
    updatedAt: new Date().toISOString(),
    ...buildUpsertPayload(values),
  };
}

export function buildUpdateBlockListPayload(entryId: string, values: BlockListFormValues): BlockListSyncChangeDto {
  return {
    id: entryId,
    updatedAt: new Date().toISOString(),
    ...buildUpsertPayload(values),
  };
}

export function buildDeleteBlockListPayload(entryId: string): BlockListSyncChangeDto {
  return {
    id: entryId,
    deleted: true,
    updatedAt: new Date().toISOString(),
  };
}
