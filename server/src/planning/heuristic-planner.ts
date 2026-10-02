import { Injectable } from '@nestjs/common';
import type { BlockSequence, LineBlocks } from './line-mapper';
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
    return this.proposeWith(ctx);
  }

  /**
   * With `lineBlocks` (which WORK blocks each study line belongs in, from a model or the reference
   * map of the user's rules), a line's sessions only go in its own blocks, a line it leaves out
   * waits, and loose tasks wait too (only a whole-plan model places those). With `sequence`, a block
   * takes its lines in order -- the first one with sessions left -- instead of taking turns.
   */
  proposeWith(ctx: PlanningContext, lineBlocks?: LineBlocks, sequence?: BlockSequence): Assignment[] {
    const queues = buildQueues(ctx, lineBlocks);
    const out: Assignment[] = [];
    let turn = 0;

    for (const slot of ctx.slots) {
      let free = slot.capacity - slot.used;
      for (;;) {
        // Next queue, in turn order (or in the block's own line order), with a task that fits here
        // and isn't held back by its line.
        const order = sequence?.get(slot.scheduleId);
        const pick = order
          ? sequentialPick(queues, order, slot.date, free)
          : queues
              .map((_, i) => queues[(turn + i) % queues.length])
              .find((q) => q.notBefore <= slot.date && (!q.allowed || q.allowed.has(slot.scheduleId)) && nextFitting(q, free) >= 0);
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
            ? pick.allowed
              ? `Según tus reglas, ${task.category ?? task.line.id} va en ${slot.label ?? 'este bloque'}; siguiente sesión en orden.`
              : `Siguiente sesión de ${task.line.id} en orden; primer hueco libre en ${slot.label ?? 'el bloque de trabajo'}.`
            : `Tarea suelta de prioridad ${task.priority}; primer hueco libre en ${slot.label ?? 'el bloque de trabajo'}.`,
        });
      }
    }
    return out;
  }
}

/** The block's first line with sessions left, if its next session can go here now. */
function sequentialPick(queues: Queue[], order: string[], date: string, free: number): Queue | undefined {
  for (const line of order) {
    const q = queues.find((x) => x.lineId === line);
    if (!q || q.tasks.length === 0) continue;
    return q.notBefore <= date && nextFitting(q, free) >= 0 ? q : undefined;
  }
  return undefined;
}

interface Queue {
  lineId: string | null;
  tasks: PlanningTask[];
  /** Study lines go strictly in order; a smaller loose task may go ahead of a big one. */
  strict: boolean;
  /** A line can't continue before the latest date its already-scheduled earlier sessions have. */
  notBefore: string;
  /** The blocks this line may use (from a line map); undefined means any. */
  allowed?: Set<string>;
}

function nextFitting(q: Queue, free: number): number {
  if (q.strict) return q.tasks.length && q.tasks[0].pomodoros <= free ? 0 : -1;
  return q.tasks.findIndex((t) => t.pomodoros <= free);
}

function buildQueues(ctx: PlanningContext, lineBlocks?: LineBlocks): Queue[] {
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
    return {
      lineId: id,
      tasks,
      strict: true,
      notBefore: anchors.sort().at(-1) ?? '',
      allowed: lineBlocks ? (lineBlocks.get(id) ?? new Set<string>()) : undefined,
    };
  });
  if (loose.length) {
    loose.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
    queues.unshift({ lineId: null, tasks: loose, strict: false, notBefore: '', allowed: lineBlocks ? new Set<string>() : undefined });
  }
  return queues;
}
