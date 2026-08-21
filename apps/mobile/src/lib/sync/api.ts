import NetInfo from '@react-native-community/netinfo';
import { apiFetch } from '../auth/api';
import type { SyncSnapshot } from '../calendar/types';
import { clearSyncQueue, enqueueSyncItem, getCachedSnapshot, getSyncQueue, getSyncQueueCount, saveCachedSnapshot } from '../offline/db';

// Ported from apps/web/src/lib/offline/sync-client.ts's pullSnapshot()/syncBatch(), same
// network-first-with-cache-fallback / queue-when-offline semantics -- see design.md for the two
// gaps this closes relative to the web version (queueing on a *failed* online request too, not
// just when NetInfo already reports offline; and routing flush conflicts through the same status
// callers can observe instead of discarding them silently).
export interface SyncBatchPayload {
  tasks?: unknown[];
  schedules?: unknown[];
  pomodoroSessions?: unknown[];
  fitnessEntries?: unknown[];
  dailyStepCounts?: unknown[];
  dailyFloorsClimbed?: unknown[];
  blockListEntries?: unknown[];
}

export interface SyncBatchResponse {
  applied: Record<string, unknown[] | undefined>;
  conflicts: Record<string, unknown[] | undefined>;
}

export interface SyncStatus {
  isOnline: boolean;
  lastPullFromCache: boolean;
  pendingQueueCount: number;
}

let status: SyncStatus = { isOnline: true, lastPullFromCache: false, pendingQueueCount: 0 };
const listeners = new Set<(status: SyncStatus) => void>();

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((listener) => listener(status));
}

export function subscribeSyncStatus(listener: (status: SyncStatus) => void): () => void {
  listeners.add(listener);
  listener(status);
  return () => listeners.delete(listener);
}

async function refreshQueueCount() {
  setStatus({ pendingQueueCount: await getSyncQueueCount() });
}

async function isConnected(): Promise<boolean> {
  const state = await NetInfo.fetch();
  // `isConnected` can be null while NetInfo is still resolving -- treat unknown as online so a
  // slow first check doesn't force every fresh app launch through the cache-only path.
  return state.isConnected !== false;
}

export async function pullSnapshot(): Promise<SyncSnapshot> {
  const online = await isConnected();
  setStatus({ isOnline: online });

  if (online) {
    try {
      const snapshot = await apiFetch<SyncSnapshot>('/sync/pull');
      await saveCachedSnapshot(snapshot);
      setStatus({ isOnline: true, lastPullFromCache: false });
      return snapshot;
    } catch (error) {
      // A request that actually fails is stronger evidence of being offline than NetInfo's own
      // pre-check -- on web, NetInfo prefers the browser's Network Information API when present,
      // which reports the OS-level interface type and doesn't necessarily update just because a
      // request was blocked (verified: it doesn't track a test harness's synthetic offline mode
      // at all). A failed request always means "couldn't reach the server" regardless of what
      // that API claims, so trust it over the pre-check.
      setStatus({ isOnline: false });
      const cached = await getCachedSnapshot();
      if (cached) {
        setStatus({ lastPullFromCache: true });
        return cached;
      }
      throw error;
    }
  }

  const cached = await getCachedSnapshot();
  if (cached) {
    setStatus({ lastPullFromCache: true });
    return cached;
  }
  throw new Error('Sin conexion y sin datos guardados localmente.');
}

async function postSyncBatch(payload: SyncBatchPayload): Promise<SyncBatchResponse> {
  return apiFetch<SyncBatchResponse>('/sync/batch', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function enqueueBatch(payload: SyncBatchPayload): Promise<void> {
  for (const [entity, items] of Object.entries(payload)) {
    if (Array.isArray(items) && items.length > 0) {
      await enqueueSyncItem(entity, items);
    }
  }
  await refreshQueueCount();
}

export async function syncBatch(payload: SyncBatchPayload): Promise<SyncBatchResponse> {
  const online = await isConnected();
  setStatus({ isOnline: online });

  if (!online) {
    await enqueueBatch(payload);
    return { applied: {}, conflicts: {} };
  }

  try {
    const response = await postSyncBatch(payload);
    setStatus({ isOnline: true });
    return response;
  } catch {
    // A request that fails despite NetInfo reporting "online" (flaky connection, server blip, or
    // -- on web -- a stale Network Information API reading, see the comment in pullSnapshot) --
    // queue instead of losing the mutation, closing a gap the web version has (there, this
    // rejects and the caller's error state is the only trace of it).
    setStatus({ isOnline: false });
    await enqueueBatch(payload);
    return { applied: {}, conflicts: {} };
  }
}

export async function flushSyncQueue(): Promise<{ flushedCount: number; response: SyncBatchResponse | null }> {
  if (!(await isConnected())) {
    return { flushedCount: 0, response: null };
  }

  const queue = await getSyncQueue();
  if (queue.length === 0) {
    return { flushedCount: 0, response: null };
  }

  const merged: SyncBatchPayload = {};
  for (const row of queue) {
    const items = JSON.parse(row.payload) as unknown[];
    const key = row.entity as keyof SyncBatchPayload;
    merged[key] = [...((merged[key] as unknown[] | undefined) ?? []), ...items];
  }

  try {
    const response = await postSyncBatch(merged);
    setStatus({ isOnline: true });
    await clearSyncQueue();
    await refreshQueueCount();
    return { flushedCount: queue.length, response };
  } catch {
    // The pre-check said online but the request still failed -- leave the queue intact (don't
    // clear it) so the next trigger (NetInfo transition, app foreground) retries instead of
    // silently losing the queued mutations.
    setStatus({ isOnline: false });
    return { flushedCount: 0, response: null };
  }
}
