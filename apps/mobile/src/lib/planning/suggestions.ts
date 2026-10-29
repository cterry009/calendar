import { apiFetch } from '../auth/api';

// The plan the daily email suggests for a day with nothing planned (server/src/daily-report), ported
// from apps/web/src/lib/planning/suggestions.ts. Online only: it lives on the server.

export interface PlanSuggestionBlock {
  label: string;
  start: string;
  end: string;
  tasks: Array<{ title: string; reason: string }>;
}

export interface PlanSuggestion {
  id: string;
  /** The day it plans, YYYY-MM-DD. */
  date: string;
  status: string;
  planner: string;
  warnings: string[];
  blocks: PlanSuggestionBlock[];
  loose: Array<{ title: string; reason: string }>;
}

export async function fetchPendingSuggestion(): Promise<PlanSuggestion | null> {
  return (await apiFetch<{ suggestion: PlanSuggestion | null }>('/planning/suggestions/pending')).suggestion;
}

export function approveSuggestion(id: string): Promise<{ scheduled: number; skipped: number }> {
  return apiFetch(`/planning/suggestions/${encodeURIComponent(id)}/approve`, { method: 'POST' });
}

export async function dismissSuggestion(id: string): Promise<void> {
  await apiFetch<void>(`/planning/suggestions/${encodeURIComponent(id)}/dismiss`, { method: 'POST' });
}
