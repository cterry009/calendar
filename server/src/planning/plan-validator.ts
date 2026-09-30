import { TaskPriority } from '@prisma/client';
import type {
  AcceptedAssignment,
  Assignment,
  PlanningContext,
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
): { accepted: AcceptedAssignment[]; rejected: RejectedAssignment[] } {
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

  // 3. Place block tasks one after another inside their block, after what's already there.
  const cursor = new Map(ctx.slots.map((s) => [slotKey(s.scheduleId, s.date), s.used]));
  const accepted = candidates.map((a): AcceptedAssignment => {
    if (a.scheduleId === null) return { ...a, startMinute: null };
    const key = slotKey(a.scheduleId, a.date);
    const slot = slots.get(key)!;
    const before = cursor.get(key)!;
    cursor.set(key, before + tasks.get(a.taskId)!.pomodoros);
    return { ...a, startMinute: slot.startMinute + before * (slot.pomodoroMin + slot.shortBreakMin) };
  });

  return { accepted, rejected };
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
