import { syncBatch } from '../offline/sync-client';
import type { BlockListFormValues } from './types';

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
}

interface SyncBatchResponse {
  applied: Record<string, unknown[] | undefined>;
  conflicts: Record<string, unknown[] | undefined>;
}

function buildUpsertPayload(
  values: BlockListFormValues,
): Omit<BlockListSyncChangeDto, 'id' | 'updatedAt'> {
  return {
    kind: values.kind,
    identifier: values.identifier.trim(),
    label: values.label.trim(),
    platform: values.platform,
    highDopamine: values.highDopamine,
    enabled: values.enabled,
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

export function buildUpdateBlockListPayload(
  entryId: string,
  values: BlockListFormValues,
): BlockListSyncChangeDto {
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
