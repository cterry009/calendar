import { apiFetch } from '../auth/api';
import type { SyncSnapshot } from '../calendar/types';

// No offline cache / WebSocket layer yet (task 6.3) -- pulls the full snapshot straight from the
// server every time, same endpoint apps/web's IndexedDB-backed sync client wraps
// (server/src/sync/sync.controller.ts). Shared by every domain (tasks, schedules, pomodoro...)
// since the server exposes one unified sync module, not per-entity REST endpoints.
export async function pullSnapshot(): Promise<SyncSnapshot> {
  return apiFetch<SyncSnapshot>('/sync/pull');
}

export interface SyncBatchPayload {
  tasks?: unknown[];
  schedules?: unknown[];
  pomodoroSessions?: unknown[];
}

export interface SyncBatchResponse {
  applied: Record<string, unknown[] | undefined>;
  conflicts: Record<string, unknown[] | undefined>;
}

export async function syncBatch(payload: SyncBatchPayload): Promise<SyncBatchResponse> {
  return apiFetch<SyncBatchResponse>('/sync/batch', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
