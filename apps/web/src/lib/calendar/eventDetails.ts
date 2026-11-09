import { isPlanCategory, PLAN_CATEGORY_INFO } from '@calendar/shared';
import type { CalendarEvent, SyncTask } from './types';

// Event details panel (2026-11-09): what an event is about, what to do in it, how to start, and its
// objectives -- worked out from data the calendar already has (the plan's phase description and
// suggested pomodoros, the block's sequence, the tasks scheduled inside it). Pure, so it's tested.

const STUDY_CATEGORIES = new Set(['estudio_b1', 'estudio_b2', 'pilar_e', 'repaso']);

/** The event a grid bar belongs to: bars of a block are `<id>`, `<id>-window` or `<id>-segment-<n>`. */
export function eventIdOfBar(barId: string): string {
  return barId.replace(/-(window|segment-\d+)$/, '');
}

export interface EventDetails {
  kindLabel: string;
  categoryName: string | null;
  about: string | null;
  todo: string[];
  howToStart: string[];
  /** Tasks scheduled inside the block (or the task itself): the event's objectives. */
  objectives: SyncTask[];
  /** Whether "Empezar" makes sense now: today, and not over. */
  startableNow: boolean;
}

const KIND_LABEL: Record<CalendarEvent['type'], string> = {
  work: 'Bloque',
  rest: 'Descanso',
  task: 'Tarea',
  pomodoro: 'Pomodoro',
  fitness: 'Ejercicio',
  habit: 'Hábito',
};

export function eventDetails(
  event: CalendarEvent,
  tasks: SyncTask[],
  suggestedPomodoros: Partial<Record<string, string[]>> | null | undefined,
  now: Date,
): EventDetails {
  const category = event.meta?.category ?? null;
  const categoryName = isPlanCategory(category) ? PLAN_CATEGORY_INFO[category].name : category;
  const startableNow =
    event.start.toDateString() === now.toDateString() && event.end.getTime() > now.getTime();
  const objectives =
    event.type === 'task'
      ? tasks.filter((t) => t.id === (event.taskId ?? event.id) && !t.deletedAt)
      : event.type === 'work'
        ? tasks
            .filter((t) => {
              if (t.deletedAt || !t.scheduledAt) return false;
              const at = new Date(t.scheduledAt).getTime();
              return at >= event.start.getTime() && at < event.end.getTime();
            })
            .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''))
        : [];

  const todo: string[] = [];
  const howToStart: string[] = [];
  let about: string | null = event.meta?.description ?? null;

  if (event.type === 'work') {
    const labels = (category && suggestedPomodoros?.[category]) || [];
    todo.push(...labels.map((label, i) => `Pomodoro ${i + 1}: ${label}`));
    if (event.meta?.flexibleBlocks) {
      howToStart.push('Pulsa «Empezar»: se abre el pomodoro de este bloque.');
      howToStart.push('Da tu motivación y concentración (0-100): de ahí sale el largo del bloque y del primer foco.');
    } else if (event.meta?.segments?.length) {
      const focos = event.meta.segments.filter((s) => s.tipo === 'foco').length;
      howToStart.push(`Pulsa «Empezar»: sigue la secuencia del bloque (${focos} pomodoros).`);
    } else {
      howToStart.push('Pulsa «Empezar»: se abre el pomodoro de este bloque.');
    }
    if (category && STUDY_CATEGORIES.has(category)) {
      howToStart.push('Abre la nota de la sección que toca; el tutor te propone el primer ejercicio.');
    }
    if (labels[0]) howToStart.push(`Primer foco: ${labels[0]}.`);
  } else if (event.type === 'task') {
    const task = objectives[0];
    about = task?.description ?? null;
    const minutes = task?.estimatedMinutes ?? Math.round((event.end.getTime() - event.start.getTime()) / 60_000);
    howToStart.push(`Pulsa «Empezar»: un pomodoro de ${Math.min(minutes, 50)} min con esta tarea.`);
  } else if (event.type === 'habit') {
    about = event.meta?.habitWhen ? `Cuándo: ${event.meta.habitWhen}` : null;
    howToStart.push('Hazlo y márcalo como hecho en el día.');
  } else if (event.type === 'rest') {
    howToStart.push('Descanso: lejos de la pantalla.');
  }

  return { kindLabel: KIND_LABEL[event.type], categoryName, about, todo, howToStart, objectives, startableNow };
}
