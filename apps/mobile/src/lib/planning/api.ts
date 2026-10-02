import type { AttentionProfile, TaskPriority } from '@calendar/shared';
import { apiFetch } from '../auth/api';

// POST /planning/propose (server/src/planning): Gemini places the pending tasks in the WORK blocks
// of the coming days and a deterministic validator filters what it proposes. Read-only -- the app
// writes only what the user accepts, through the normal sync batch.

export interface PlanAssignment {
  taskId: string;
  date: string;
  scheduleId: string | null;
  priority: TaskPriority;
  reason: string;
  /** Minutes from local midnight where it starts inside its block; null for "that day, any time". */
  startMinute: number | null;
  complexity: number;
}

export interface PlanBlockRating {
  scheduleId: string;
  date: string;
  label: string | null;
  complexity: number;
  load: string;
  pomodoros: number;
  capacity: number;
}

export interface PlanProposal {
  planner: string;
  complexitySource: string;
  warnings: string[];
  days: string[];
  accepted: PlanAssignment[];
  rejected: Array<{ assignment: Omit<PlanAssignment, 'startMinute' | 'complexity'>; reasons: string[] }>;
  blocks: PlanBlockRating[];
  unplaced: string[];
}

export function proposePlan(input: { timeZone: string; from: string; days: number }): Promise<PlanProposal> {
  // Gemini can take a couple of minutes (and tries a few models when the free tier is busy).
  return apiFetch<PlanProposal>('/planning/propose', { method: 'POST', body: JSON.stringify(input) }, true, 6 * 60_000);
}

/** Where the plan starts: today while it's Monday-Thursday, next Monday from Friday on. */
export function weekToPlan(now: Date = new Date()): string {
  const day = now.getDay(); // 0 Sunday
  const offset = day >= 1 && day <= 4 ? 0 : (8 - day) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
}

export type { AttentionProfile };
