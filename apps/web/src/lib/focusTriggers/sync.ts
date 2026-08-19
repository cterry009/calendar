import { syncBatch } from '../offline/sync-client';
import type { FocusTriggerFormValues } from './types';

export interface FocusTriggerSyncChangeDto {
  id?: string;
  updatedAt: string;
  deleted?: boolean;
  kind?: FocusTriggerFormValues['kind'];
  label?: string;
  enabled?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  radiusMeters?: number | null;
  wifiSsid?: string | null;
}

interface SyncBatchResponse {
  applied: Record<string, unknown[] | undefined>;
  conflicts: Record<string, unknown[] | undefined>;
}

function buildUpsertPayload(
  values: FocusTriggerFormValues,
): Omit<FocusTriggerSyncChangeDto, 'id' | 'updatedAt'> {
  return {
    kind: values.kind,
    label: values.label.trim(),
    enabled: values.enabled,
    latitude: values.kind === 'LOCATION' ? values.latitude : null,
    longitude: values.kind === 'LOCATION' ? values.longitude : null,
    radiusMeters: values.kind === 'LOCATION' ? values.radiusMeters : null,
    wifiSsid: values.kind === 'WIFI' ? values.wifiSsid?.trim() || null : null,
  };
}

export async function syncFocusTriggerBatch(changes: FocusTriggerSyncChangeDto[]): Promise<SyncBatchResponse> {
  if (!changes.length) {
    return { applied: {}, conflicts: {} };
  }

  return syncBatch({ focusTriggers: changes });
}

export function buildCreateFocusTriggerPayload(values: FocusTriggerFormValues): FocusTriggerSyncChangeDto {
  return {
    updatedAt: new Date().toISOString(),
    ...buildUpsertPayload(values),
  };
}

export function buildUpdateFocusTriggerPayload(
  triggerId: string,
  values: FocusTriggerFormValues,
): FocusTriggerSyncChangeDto {
  return {
    id: triggerId,
    updatedAt: new Date().toISOString(),
    ...buildUpsertPayload(values),
  };
}

export function buildDeleteFocusTriggerPayload(triggerId: string): FocusTriggerSyncChangeDto {
  return {
    id: triggerId,
    deleted: true,
    updatedAt: new Date().toISOString(),
  };
}
