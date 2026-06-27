import { apiFetch } from '../api';
import { generateDashboardDemoData } from './demo-data';
import type { DashboardDemoPayload } from './types';

interface SyncBatchResponse {
  applied: Record<string, unknown[] | undefined>;
  conflicts: Record<string, unknown[] | undefined>;
}

export async function seedDemoData(payload: DashboardDemoPayload = generateDashboardDemoData()) {
  return apiFetch<SyncBatchResponse>('/sync/batch', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
