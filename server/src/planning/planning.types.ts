import type { TaskPriority } from '@prisma/client';

// Everything a planner sees and returns (task 8.13). A planner -- today the deterministic heuristic,
// later an LLM called through tool use -- only *proposes* `Assignment`s; `validatePlan` is the one
// that decides what reaches the user, and nothing is written until the user accepts in the app.

/** A pending task, reduced to what planning needs. */
export interface PlanningTask {
  id: string;
  title: string;
  category: string | null;
  priority: TaskPriority;
  pomodoros: number;
  /** Local date (YYYY-MM-DD) it's already on, or null when it still needs a place. */
  scheduledDate: string | null;
  /** Study-plan line and position in it, for tasks imported from the vault (see study-line.ts). */
  line: { id: string; order: number } | null;
}

/** One WORK schedule on one day, with how many pomodoros are still free in it. */
export interface PlanningSlot {
  scheduleId: string;
  label: string | null;
  date: string;
  startMinute: number;
  endMinute: number;
  pomodoroMin: number;
  shortBreakMin: number;
  capacity: number;
  used: number;
}

export interface PlanningContext {
  /** Local dates covered, first to last. */
  days: string[];
  /** Tasks the planner may place (pending and unscheduled). */
  tasks: PlanningTask[];
  /** Pending tasks already on the calendar: they take room and anchor study-line order. */
  scheduled: PlanningTask[];
  slots: PlanningSlot[];
}

/** What a planner proposes: `scheduleId` null means "that day, whenever" instead of a block. */
export interface Assignment {
  taskId: string;
  date: string;
  scheduleId: string | null;
  priority: TaskPriority;
  reason: string;
}

export interface AcceptedAssignment extends Assignment {
  /** Where inside the block it starts (minutes from local midnight); null for "whenever" tasks. */
  startMinute: number | null;
}

export interface RejectedAssignment {
  assignment: Assignment;
  reasons: string[];
}

export interface PlanProposal {
  planner: string;
  days: string[];
  accepted: AcceptedAssignment[];
  rejected: RejectedAssignment[];
  /** Tasks that ended up without a place (never proposed, or proposed and rejected). */
  unplaced: string[];
}
