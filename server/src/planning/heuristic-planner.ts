import { Injectable } from '@nestjs/common';
import type { Assignment, PlanningContext, PlanningTask } from './planning.types';
import type { Planner } from './planner';

const PRIORITY_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;

/**
 * The no-API planner: fills WORK blocks in time order, taking turns between study lines (and loose
 * tasks, highest priority first) so no line starves, and keeping each line in pensum order. A task
 * that doesn't fit whole in what's left of a block waits for the next block -- tasks aren't split.
 * It stays as the fallback once an LLM planner exists.
 */
@Injectable()
export class HeuristicPlanner implements Planner {
  readonly name = 'heuristic';

  async propose(ctx: PlanningContext): Promise<Assignment[]> {
    const queues = buildQueues(ctx);
    const out: Assignment[] = [];
    let turn = 0;

    for (const slot of ctx.slots) {
      let free = slot.capacity - slot.used;
      for (;;) {
        // Next queue, in turn order, with a task that fits here and isn't held back by its line.
        const pick = queues
          .map((_, i) => queues[(turn + i) % queues.length])
          .find((q) => q.notBefore <= slot.date && nextFitting(q, free) >= 0);
        if (!pick) break;
        const [task] = pick.tasks.splice(nextFitting(pick, free), 1);
        free -= task.pomodoros;
        turn = (queues.indexOf(pick) + 1) % queues.length;
        out.push({
          taskId: task.id,
          date: slot.date,
          scheduleId: slot.scheduleId,
          priority: task.priority,
          reason: task.line
            ? `Siguiente sesión de ${task.line.id} en orden; primer hueco libre en ${slot.label ?? 'el bloque de trabajo'}.`
            : `Tarea suelta de prioridad ${task.priority}; primer hueco libre en ${slot.label ?? 'el bloque de trabajo'}.`,
        });
      }
    }
    return out;
  }
}

interface Queue {
  tasks: PlanningTask[];
  /** Study lines go strictly in order; a smaller loose task may go ahead of a big one. */
  strict: boolean;
  /** A line can't continue before the latest date its already-scheduled earlier sessions have. */
  notBefore: string;
}

function nextFitting(q: Queue, free: number): number {
  if (q.strict) return q.tasks.length && q.tasks[0].pomodoros <= free ? 0 : -1;
  return q.tasks.findIndex((t) => t.pomodoros <= free);
}

function buildQueues(ctx: PlanningContext): Queue[] {
  const lines = new Map<string, PlanningTask[]>();
  const loose: PlanningTask[] = [];
  for (const t of ctx.tasks) {
    if (t.line) lines.set(t.line.id, [...(lines.get(t.line.id) ?? []), t]);
    else loose.push(t);
  }

  const queues: Queue[] = [...lines].map(([id, tasks]) => {
    tasks.sort((a, b) => a.line!.order - b.line!.order);
    const first = tasks[0].line!.order;
    const anchors = ctx.scheduled
      .filter((t) => t.line?.id === id && t.line.order < first && t.scheduledDate)
      .map((t) => t.scheduledDate!);
    return { tasks, strict: true, notBefore: anchors.sort().at(-1) ?? '' };
  });
  if (loose.length) {
    loose.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
    queues.unshift({ tasks: loose, strict: false, notBefore: '' });
  }
  return queues;
}
