import { TaskPriority } from '@prisma/client';
import type {
  AcceptedAssignment,
  Assignment,
  BlockLoad,
  BlockRating,
  PlanningContext,
  PlanningSlot,
  PlanningTask,
  RejectedAssignment,
} from './planning.types';
import { slotKey } from './slots';

// The deterministic gate every proposal goes through, whoever made it (task 8.13, point 3). An
// LLM's output is data, not a decision: this rejects anything that overfills a block, lands a block
// task outside a WORK block, or schedules a study session before the ones that come before it.

const PRIORITIES = new Set<string>(Object.values(TaskPriority));

export function validatePlan(
  ctx: PlanningContext,
  assignments: Assignment[],
): { accepted: AcceptedAssignment[]; rejected: RejectedAssignment[]; blocks: BlockRating[] } {
  const tasks = new Map(ctx.tasks.map((t) => [t.id, t]));
  const slots = new Map(ctx.slots.map((s) => [slotKey(s.scheduleId, s.date), s]));
  const days = new Set(ctx.days);
  const rejected: RejectedAssignment[] = [];
  const seen = new Set<string>();

  // 1. Checks that don't depend on the rest of the plan.
  let candidates: Assignment[] = [];
  for (const a of assignments) {
    const reasons: string[] = [];
    if (!tasks.has(a.taskId)) reasons.push('La tarea no existe, no está pendiente o ya tiene fecha.');
    else if (seen.has(a.taskId)) reasons.push('La tarea aparece dos veces en el plan.');
    if (!days.has(a.date)) reasons.push(`La fecha ${a.date} está fuera del horizonte del plan.`);
    if (!PRIORITIES.has(a.priority)) reasons.push(`Prioridad inválida: ${String(a.priority)}.`);
    if (a.scheduleId !== null && days.has(a.date) && !slots.has(slotKey(a.scheduleId, a.date))) {
      reasons.push('El bloque no es un bloque de trabajo (WORK) activo ese día.');
    }
    seen.add(a.taskId);
    if (reasons.length) rejected.push({ assignment: a, reasons });
    else candidates.push(a);
  }

  // 2. Study-line order and block capacity depend on each other (dropping one session can break
  // the order of the next), so re-check until nothing else falls out. Each round drops >= 1.
  for (;;) {
    const failures = new Map<Assignment, string>();
    const orderOk = checkLineOrder(ctx, candidates, tasks, failures);
    checkCapacity(ctx, orderOk, tasks, failures);
    if (failures.size === 0) break;
    for (const [a, reason] of failures) rejected.push({ assignment: a, reasons: [reason] });
    candidates = candidates.filter((a) => !failures.has(a));
  }

  // 3. Inside each block the hardest task goes on top (first), then the rest one after another,
  // after what's already there -- a study line still keeps its own order.
  const byBlock = new Map<string, Assignment[]>();
  const accepted: AcceptedAssignment[] = [];
  for (const a of candidates) {
    if (a.scheduleId === null) accepted.push({ ...a, startMinute: null, complexity: tasks.get(a.taskId)!.complexity });
    else byBlock.set(slotKey(a.scheduleId, a.date), [...(byBlock.get(slotKey(a.scheduleId, a.date)) ?? []), a]);
  }
  const blocks: BlockRating[] = [];
  for (const [key, list] of byBlock) {
    const slot = slots.get(key)!;
    const ordered = hardestFirst(list, tasks);
    let cursor = slot.used;
    for (const a of ordered) {
      const task = tasks.get(a.taskId)!;
      accepted.push({ ...a, startMinute: slot.startMinute + cursor * (slot.pomodoroMin + slot.shortBreakMin), complexity: task.complexity });
      cursor += task.pomodoros;
    }
    blocks.push(rateBlock(slot, ordered.map((a) => tasks.get(a.taskId)!)));
  }
  accepted.sort((a, b) => a.date.localeCompare(b.date) || (a.startMinute ?? 24 * 60) - (b.startMinute ?? 24 * 60));
  blocks.sort((a, b) => a.date.localeCompare(b.date) || slots.get(slotKey(a.scheduleId, a.date))!.startMinute - slots.get(slotKey(b.scheduleId, b.date))!.startMinute);

  return { accepted, rejected, blocks };
}

const PROFILE_RANK = { MECHANICAL: 0, LIGHT: 1, DEEP: 2 } as const;

/** How demanding a task is, for ordering: its attention profile first, then its complexity. */
function demand(task: PlanningTask): number {
  return (task.attentionProfile ? PROFILE_RANK[task.attentionProfile] : PROFILE_RANK.LIGHT) * 100 + task.complexity;
}

/** Most demanding first (stable on ties); tasks of one study line then take their slots in pensum order. */
export function hardestFirst(list: Assignment[], tasks: Map<string, PlanningTask>): Assignment[] {
  const sorted = [...list].sort((a, b) => demand(tasks.get(b.taskId)!) - demand(tasks.get(a.taskId)!));
  const lines = new Map<string, number[]>();
  sorted.forEach((a, i) => {
    const line = tasks.get(a.taskId)!.line;
    if (line) lines.set(line.id, [...(lines.get(line.id) ?? []), i]);
  });
  for (const positions of lines.values()) {
    const inOrder = positions.map((i) => sorted[i]).sort((a, b) => tasks.get(a.taskId)!.line!.order - tasks.get(b.taskId)!.line!.order);
    positions.forEach((pos, k) => (sorted[pos] = inOrder[k]));
  }
  return sorted;
}

export function loadOf(complexity: number): BlockLoad {
  return complexity <= 4 ? 'ligero' : complexity <= 6 ? 'medio' : 'exigente';
}

function rateBlock(slot: PlanningSlot, placed: PlanningTask[]): BlockRating {
  const pomodoros = placed.reduce((n, t) => n + t.pomodoros, 0);
  const complexity = Math.round((placed.reduce((n, t) => n + t.complexity * t.pomodoros, 0) / pomodoros) * 10) / 10;
  return {
    scheduleId: slot.scheduleId,
    date: slot.date,
    label: slot.label,
    complexity,
    load: loadOf(complexity),
    pomodoros: slot.used + pomodoros,
    capacity: slot.capacity,
  };
}

/** Rejects a session dated before an earlier pending session of its line, or with one left undated. */
function checkLineOrder(
  ctx: PlanningContext,
  candidates: Assignment[],
  tasks: Map<string, PlanningTask>,
  failures: Map<Assignment, string>,
): Assignment[] {
  const dateOf = new Map<string, string>();
  for (const t of ctx.scheduled) if (t.scheduledDate) dateOf.set(t.id, t.scheduledDate);
  for (const a of candidates) dateOf.set(a.taskId, a.date);

  const lines = new Map<string, PlanningTask[]>();
  for (const t of [...ctx.tasks, ...ctx.scheduled]) {
    if (!t.line) continue;
    lines.set(t.line.id, [...(lines.get(t.line.id) ?? []), t]);
  }
  for (const list of lines.values()) list.sort((a, b) => a.line!.order - b.line!.order);

  const ok: Assignment[] = [];
  for (const a of candidates) {
    const task = tasks.get(a.taskId)!;
    const earlier = task.line ? lines.get(task.line.id)!.filter((t) => t.line!.order < task.line!.order) : [];
    const blocker = earlier.find((t) => !dateOf.has(t.id) || dateOf.get(t.id)! > a.date);
    if (blocker) {
      failures.set(a, `Rompe el orden del pensum: «${blocker.title}» va antes y ${dateOf.has(blocker.id) ? `está el ${dateOf.get(blocker.id)}` : 'queda sin fecha'}.`);
    } else ok.push(a);
  }
  return ok;
}

function checkCapacity(
  ctx: PlanningContext,
  candidates: Assignment[],
  tasks: Map<string, PlanningTask>,
  failures: Map<Assignment, string>,
): void {
  const used = new Map(ctx.slots.map((s) => [slotKey(s.scheduleId, s.date), s.used]));
  const capacity = new Map(ctx.slots.map((s) => [slotKey(s.scheduleId, s.date), s.capacity]));
  for (const a of candidates) {
    if (a.scheduleId === null) continue;
    const key = slotKey(a.scheduleId, a.date);
    const need = tasks.get(a.taskId)!.pomodoros;
    const free = capacity.get(key)! - used.get(key)!;
    if (need > free) failures.set(a, `No cabe en el bloque: necesita ${need} pomodoros y quedan ${free}.`);
    else used.set(key, used.get(key)! + need);
  }
}
