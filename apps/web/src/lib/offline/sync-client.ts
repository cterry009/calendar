import { apiFetch } from '../api';
import type { SyncSnapshot } from '../calendar/types';
import { IDB_STORES, idbGet, idbGetAll, idbPut } from './idb';
import type { PullSnapshotResult, SyncBatchBody, SyncBatchResponse, SyncQueueItem } from './types';
import { SNAPSHOT_CACHE_KEY } from './types';

export function isBrowserOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export async function getCachedSnapshot(): Promise<SyncSnapshot | null> {
  const cached = await idbGet<SyncSnapshot>(IDB_STORES.snapshots, SNAPSHOT_CACHE_KEY);
  return cached ?? null;
}

export async function saveCachedSnapshot(snapshot: SyncSnapshot): Promise<void> {
  await idbPut(IDB_STORES.snapshots, snapshot, SNAPSHOT_CACHE_KEY);
}

export async function pullSnapshot(): Promise<PullSnapshotResult> {
  if (isBrowserOnline()) {
    try {
      const snapshot = await apiFetch<SyncSnapshot>('/sync/pull');
      await saveCachedSnapshot(snapshot);
      return { snapshot, fromCache: false };
    } catch {
      const cached = await getCachedSnapshot();
      if (cached) {
        return { snapshot: cached, fromCache: true };
      }
      throw new Error('No se pudo cargar datos y no hay copia local disponible.');
    }
  }

  const cached = await getCachedSnapshot();
  if (!cached) {
    throw new Error('Sin conexion. No hay datos guardados localmente todavia.');
  }

  return { snapshot: cached, fromCache: true };
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const items = await idbGetAll<SyncQueueItem>(IDB_STORES.syncQueue);
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function enqueueSyncItem(entity: SyncQueueItem['entity'], payload: unknown[]): Promise<void> {
  const item: SyncQueueItem = {
    entity,
    payload,
    createdAt: new Date().toISOString(),
  };

  await idbPut(IDB_STORES.syncQueue, item);
}

export async function clearSyncQueue(): Promise<void> {
  const { idbClear } = await import('./idb');
  await idbClear(IDB_STORES.syncQueue);
}

export async function postSyncBatch(body: SyncBatchBody): Promise<SyncBatchResponse> {
  return apiFetch<SyncBatchResponse>('/sync/batch', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function syncBatch(body: SyncBatchBody): Promise<SyncBatchResponse> {
  if (!isBrowserOnline()) {
    const entries = Object.entries(body) as [SyncQueueItem['entity'], unknown[]][];
    for (const [entity, payload] of entries) {
      if (payload?.length) {
        await enqueueSyncItem(entity, payload);
      }
    }
    return { applied: {}, conflicts: {} };
  }

  return postSyncBatch(body);
}

export async function flushSyncQueue(): Promise<number> {
  if (!isBrowserOnline()) {
    return 0;
  }

  const queue = await getSyncQueue();
  if (!queue.length) {
    return 0;
  }

  const merged: SyncBatchBody = {};

  for (const item of queue) {
    const current = (merged[item.entity] ?? []) as unknown[];
    merged[item.entity] = [...current, ...item.payload];
  }

  await postSyncBatch(merged);
  await clearSyncQueue();
  await pullSnapshot();

  return queue.length;
}
