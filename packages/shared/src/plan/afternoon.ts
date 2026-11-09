// Afternoon v3 (2026-11-08): the weekday afternoons of horario.ts's new template applied to an existing
// timetable in place ("Actualizar las tardes"), the same way weekdayV2Changes did the jornada (D30):
// every schedule id that can be kept is kept, so completions, exceptions and history stay attached.
// A schedule that no longer has a place is disabled, not deleted -- deleting a Schedule cascades to its
// ScheduleCompletion rows.

import { HORARIO_2026, type WeeklyTemplate } from './horario.js';
import { templateToSchedules, type StudyPlanData, type TemplateSchedule } from './plan.js';
import type { SequenceSegment } from './sequence.js';

export interface AfternoonScheduleLike {
  id: string;
  kind: 'WORK' | 'REST';
  daysOfWeek: number[];
  startMinute: number;
  endMinute: number;
  label?: string | null;
  category?: string | null;
  sequence?: SequenceSegment[] | null;
  flexibleBlocks?: number | null;
  enabled?: boolean;
  deletedAt?: string | null;
}

export interface AfternoonV3Changes<S extends AfternoonScheduleLike> {
  /** Kept schedules with their new days, title and category (same ids). */
  updates: S[];
  /** Blocks no existing schedule could take. */
  creates: Array<Omit<S, 'id'>>;
  /** Schedules left without a place, to send with enabled: false. */
  disables: S[];
}

const AFTERNOON_FROM = 13 * 60;

const isWeekdayAfternoonWork = (s: Pick<AfternoonScheduleLike, 'kind' | 'daysOfWeek' | 'startMinute'>) =>
  s.kind === 'WORK' && s.startMinute >= AFTERNOON_FROM && s.daysOfWeek.some((d) => d >= 1 && d <= 5);

/** The template's weekday afternoon blocks as schedules (one per title, category and start). */
export function afternoonTargets(
  template: WeeklyTemplate = HORARIO_2026.plantilla_semanal,
): TemplateSchedule[] {
  return templateToSchedules(template).filter(isWeekdayAfternoonWork);
}

const sameDays = (a: number[], b: number[]) =>
  a.length === b.length && [...a].sort().every((d, i) => d === [...b].sort()[i]);

export function afternoonV3Changes<S extends AfternoonScheduleLike>(
  schedules: S[],
  targets: TemplateSchedule[] = afternoonTargets(),
): AfternoonV3Changes<S> {
  const live = schedules.filter(
    (s) => !s.deletedAt && s.enabled !== false && isWeekdayAfternoonWork(s),
  );
  const used = new Set<string>();
  const result: AfternoonV3Changes<S> = { updates: [], creates: [], disables: [] };

  // Exact matches first, so a block already as it should be is never taken by another target.
  const score = (s: S, t: TemplateSchedule) =>
    (s.category === t.category ? 2 : 0) + (s.label === t.label ? 1 : 0) +
    (sameDays(s.daysOfWeek, t.daysOfWeek) ? 4 : 0);
  const pending: TemplateSchedule[] = [];
  for (const t of targets) {
    const exact = live.find(
      (s) =>
        !used.has(s.id) &&
        s.startMinute === t.startMinute &&
        s.endMinute === t.endMinute &&
        s.label === t.label &&
        s.category === t.category &&
        sameDays(s.daysOfWeek, t.daysOfWeek) &&
        (s.flexibleBlocks ?? null) === (t.flexibleBlocks ?? null) &&
        !s.sequence,
    );
    if (exact) used.add(exact.id);
    else pending.push(t);
  }
  for (const t of pending) {
    // An existing schedule at the same start that covers one of the target's days.
    const candidates = live
      .filter(
        (s) =>
          !used.has(s.id) &&
          s.startMinute === t.startMinute &&
          s.daysOfWeek.some((d) => t.daysOfWeek.includes(d)),
      )
      .sort((a, b) => score(b, t) - score(a, t));
    const reuse = candidates[0];
    if (reuse) {
      used.add(reuse.id);
      result.updates.push({
        ...reuse,
        daysOfWeek: [...t.daysOfWeek],
        startMinute: t.startMinute,
        endMinute: t.endMinute,
        label: t.label,
        category: t.category,
        sequence: null,
        flexibleBlocks: t.flexibleBlocks,
      });
    } else {
      result.creates.push({
        kind: 'WORK',
        daysOfWeek: [...t.daysOfWeek],
        startMinute: t.startMinute,
        endMinute: t.endMinute,
        label: t.label,
        category: t.category,
        sequence: null,
        flexibleBlocks: t.flexibleBlocks,
        enabled: true,
      } as unknown as Omit<S, 'id'>);
    }
  }
  for (const s of live) if (!used.has(s.id)) result.disables.push({ ...s, enabled: false });
  return result;
}

/** Whether an existing timetable still needs afternoonV3Changes ("Actualizar las tardes"). */
export function needsAfternoonUpdate(schedules: AfternoonScheduleLike[]): boolean {
  const c = afternoonV3Changes(schedules);
  return c.updates.length + c.creates.length + c.disables.length > 0;
}

// The plan side of afternoon v3: each phase's content for carrera (the UNAL instead of the search
// abroad), maestria and paper, and the suggested pomodoros of the two new categories, laid over the
// user's synced plan. Everything else in the plan -- other categories, milestones, the night window --
// is the user's and stays as it is.
const PLAN_V3_CATEGORIES = ['carrera', 'maestria', 'paper'] as const;

export function planV3(plan: StudyPlanData): StudyPlanData {
  const fases = plan.fases.map((fase) => {
    const template = HORARIO_2026.fases.find((f) => f.nombre === fase.nombre);
    if (!template) return fase;
    const contenido = { ...fase.contenido };
    for (const c of PLAN_V3_CATEGORIES) {
      const text = template.contenido[c];
      if (text) contenido[c] = text;
    }
    return { ...fase, contenido };
  });
  return {
    ...plan,
    fases,
    pomodoros_sugeridos: {
      ...plan.pomodoros_sugeridos,
      maestria: HORARIO_2026.pomodoros_sugeridos.maestria,
      paper: HORARIO_2026.pomodoros_sugeridos.paper,
    },
  };
}

export function needsPlanV3(plan: StudyPlanData | null | undefined): boolean {
  return !!plan && JSON.stringify(planV3(plan)) !== JSON.stringify(plan);
}
