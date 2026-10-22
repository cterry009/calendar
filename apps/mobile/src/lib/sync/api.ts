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
  focusEvents?: unknown[];
  fitnessEntries?: unknown[];
  dailyStepCounts?: unknown[];
  dailyFloorsClimbed?: unknown[];
  blockListEntries?: unknown[];
  habits?: unknown[];
  habitRecords?: unknown[];
  blockEvents?: unknown[];
  dailyScreenTime?: unknown[];
  scheduleCompletions?: unknown[];
  scheduleExceptions?: unknown[];
  studyPlan?: unknown[];
  exerciseAttempts?: unknown[];
}

export interface SyncBatchResponse {
  applied: Record<string, unknown[] | undefined>;
  conflicts: Record<string, unknown[] | undefined>;
  // True when this call only queued the mutation locally instead of actually reaching the server
  // (offline, or an online request that failed). Callers must not treat a queued response as
  // confirmation the mutation is reflected server-side -- a refetch() right after one returns the
  // stale pre-mutation snapshot (server truth, or the offline cache) and silently reverts any
  // optimistic UI update, e.g. leaving a cancelled pomodoro session looking "active" again. See
  // PomodoroContext.tsx's persistSession for the fix this enables.
  queued?: boolean;
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

// Real bug found and fixed: pullSnapshot/syncBatch/flushSyncQueue used to each start with a raw
// NetInfo.fetch() pre-check and skip the real request entirely when it reported "offline" --
// inconsistent with this file's own documented reasoning below ("a request that actually fails is
// stronger evidence... than NetInfo's own pre-check"), which was only ever applied on the catch
// side. Confirmed on-device on a private/LAN-only dev network (phone reaching a PC's local server
// with no real internet gateway behind it): Android's own reachability validation reports this as
// "no internet", NetInfo follows that, and every gated call skipped straight to the cached/queued
// fallback forever -- even though the phone could reach the server directly the whole time. Fixed
// by always attempting the real request first in all three and trusting its outcome, removing the
// pre-check (and the now-unused NetInfo import) entirely. NetInfo is still used, just as a
// best-effort flush *trigger* in SyncContext's own event listener -- never as a gate on whether an
// attempt happens.
export async function pullSnapshot(): Promise<SyncSnapshot> {
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
  try {
    const response = await postSyncBatch(payload);
    setStatus({ isOnline: true });
    return response;
  } catch {
    // A request that fails is stronger evidence of being offline than NetInfo's own pre-check
    // (see the comment in pullSnapshot) -- queue instead of losing the mutation, closing a gap
    // the web version has (there, this rejects and the caller's error state is the only trace of
    // it).
    setStatus({ isOnline: false });
    await enqueueBatch(payload);
    return { applied: {}, conflicts: {}, queued: true };
  }
}

// Used to gate on a NetInfo pre-check too (see pullSnapshot's doc comment) -- was the most visibly
// broken of the three, since this is what the 5s poll-when-queued fallback in SyncContext calls
// repeatedly: it kept bailing before ever trying, so a queued mutation could stall forever on a
// network NetInfo misreports as offline. An empty queue is already a no-op via the length check
// below, so removing the pre-check just means a real failure lands in the catch block instead.
export async function flushSyncQueue(): Promise<{ flushedCount: number; response: SyncBatchResponse | null }> {
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
    // Leave the queue intact (don't clear it) so the next trigger (NetInfo transition, app
    // foreground, the 5s poll) retries instead of silently losing the queued mutations.
    setStatus({ isOnline: false });
    return { flushedCount: 0, response: null };
  }
}
