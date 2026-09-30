import type { Assignment, PlanningContext } from './planning.types';

/**
 * Anything that can propose a plan. The heuristic one is the only implementation today; an LLM
 * planner (task 8.13) will implement this same interface, turning the model's `assign` tool calls
 * into `Assignment`s -- and its output still goes through validatePlan like everyone else's.
 */
export interface Planner {
  readonly name: string;
  propose(ctx: PlanningContext): Promise<Assignment[]>;
}

export const PLANNER = Symbol('PLANNER');
