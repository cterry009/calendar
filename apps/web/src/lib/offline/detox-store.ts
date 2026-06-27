import type { DetoxPlan } from '@calendar/shared';
import { IDB_STORES, idbGet, idbPut } from './idb';

const DETOX_PLAN_KEY = 'current';

export async function loadDetoxPlan(): Promise<DetoxPlan | null> {
  const plan = await idbGet<DetoxPlan>(IDB_STORES.detoxPlan, DETOX_PLAN_KEY);
  return plan ?? null;
}

export async function saveDetoxPlan(plan: DetoxPlan): Promise<void> {
  await idbPut(IDB_STORES.detoxPlan, plan, DETOX_PLAN_KEY);
}

export async function clearDetoxPlan(): Promise<void> {
  const { idbDelete } = await import('./idb');
  await idbDelete(IDB_STORES.detoxPlan, DETOX_PLAN_KEY);
}
