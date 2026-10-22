// The weekly template + phased plan (horario 2026-10-19). The template lives in the user's
// recurring Schedules (each with a category and a pomodoro sequence); the plan (start Monday,
// phases, suggested pomodoros, milestones, adjustment rules) is one synced StudyPlan; a one-off
// change to a block on one day is a ScheduleException. Weeks are computed, never stored: a day's
// blocks are always "the template, plus that day's exceptions".

import {
  HORARIO_2026,
  PLAN_DAY_KEYS,
  PLAN_WEEKS,
  isPlanCategory,
  type PlanCategory,
  type PlanMilestone,
  type PlanPhase,
  type PlanSequences,
  type WeeklyTemplate,
} from './horario.js';
import { fitSequence, labelSequence, type SequenceSegment, type TimedSegment } from './sequence.js';

// ─── Plan data ───────────────────────────────────────────────────────────────

/** What a StudyPlan row holds (planData). */
export interface StudyPlanData {
  /** Monday of week 1, YYYY-MM-DD (local calendar day). */
  startDate: string;
  weeks: number;
  fases: PlanPhase[];
  pomodoros_sugeridos: Partial<Record<PlanCategory, string[]>>;
  hitos: PlanMilestone[];
  reglas_de_ajuste: string[];
  /**
   * The night block window, the same on the phone and the PC (2026-10-15: each device kept its
   * own and they drifted apart). Each device applies it when it changes and writes it back when
   * edited there. Absent on plans saved before.
   */
  nightWindow?: NightWindowSetting;
}

export interface NightWindowSetting {
  startMinutes: number;
  endMinutes: number;
}

/** 22:00-08:00 (2026-10-15). */
export const DEFAULT_PLAN_NIGHT_WINDOW: NightWindowSetting = {
  startMinutes: 22 * 60,
  endMinutes: 8 * 60,
};

/** The night block can't be shorter than this (8 h since 2026-10-15, was 10 h on the phone). */
export const MIN_NIGHT_WINDOW_HOURS = 8;

export function defaultStudyPlanData(startDate: string): StudyPlanData {
  return {
    startDate,
    nightWindow: DEFAULT_PLAN_NIGHT_WINDOW,
    weeks: PLAN_WEEKS,
    fases: HORARIO_2026.fases,
    pomodoros_sugeridos: HORARIO_2026.pomodoros_sugeridos,
    hitos: HORARIO_2026.hitos,
    reglas_de_ajuste: HORARIO_2026.reglas_de_ajuste,
  };
}

// ─── Day keys ────────────────────────────────────────────────────────────────
// A day is a local calendar date as YYYY-MM-DD; the arithmetic below runs on UTC midnights of
// those keys so DST never shifts a day.

const DAY_MS = 24 * 60 * 60 * 1000;

function keyToUtc(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcToKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The local calendar day of a Date as YYYY-MM-DD. */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysToKey(key: string, days: number): string {
  return utcToKey(keyToUtc(key) + days * DAY_MS);
}

/** 0 = Sunday ... 6 = Saturday, like Schedule.daysOfWeek. */
export function dayOfWeekOfKey(key: string): number {
  return new Date(keyToUtc(key)).getUTCDay();
}

export function isMondayKey(key: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && dayOfWeekOfKey(key) === 1;
}

/** The next Monday after `from` (a week later if `from` is a Monday): the plan's default start. */
export function nextMondayKey(from: Date): string {
  const key = localDateKey(from);
  const dow = dayOfWeekOfKey(key);
  return addDaysToKey(key, (8 - dow) % 7 || 7);
}

/** Plan week of a day: 1 for the start week, 0 or less before it, past `weeks` after the plan. */
export function planWeekOf(plan: Pick<StudyPlanData, 'startDate'>, dateKey: string): number {
  return Math.floor((keyToUtc(dateKey) - keyToUtc(plan.startDate)) / (7 * DAY_MS)) + 1;
}

/** Monday of a plan week. */
export function planWeekStart(plan: Pick<StudyPlanData, 'startDate'>, week: number): string {
  return addDaysToKey(plan.startDate, (week - 1) * 7);
}

export function phaseForWeek(plan: Pick<StudyPlanData, 'fases'>, week: number): PlanPhase | null {
  return plan.fases.find((phase) => week >= phase.semanas[0] && week <= phase.semanas[1]) ?? null;
}

/** A block's description: what its category covers in the week's phase (none outside the plan). */
export function blockDescription(
  plan: Pick<StudyPlanData, 'fases'>,
  category: string | null | undefined,
  week: number,
): string | null {
  if (!isPlanCategory(category)) return null;
  return phaseForWeek(plan, week)?.contenido[category] ?? null;
}

// ─── Template -> schedules ───────────────────────────────────────────────────

export function parseClock(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

/** What a template block or break becomes: a recurring Schedule (create payload). */
export interface TemplateSchedule {
  kind: 'WORK' | 'REST';
  daysOfWeek: number[];
  startMinute: number;
  endMinute: number;
  label: string;
  category: PlanCategory | null;
  sequence: SequenceSegment[] | null;
  /**
   * A flexible weekday block (2026-10-22, revision 2): 1, started on demand at any time, its hours only a
   * suggestion; sized by diagnoses (morning.ts). Null for a fixed, clock-anchored block (Saturday).
   */
  flexibleBlocks: number | null;
}

export const MORNING_CATEGORIES: readonly PlanCategory[] = ['estudio_b1', 'estudio_b2', 'pilar_e'];

/** Which fixed sequence a template block uses (nota_secuencias): Saturday's; weekday blocks have none. */
function sequenceForTemplateBlock(day: string, sequences: PlanSequences): SequenceSegment[] | null {
  return day === 'sabado' ? sequences.sabado : null;
}

/**
 * The template as recurring Schedules. The same block on several days (Estudio B1 on Monday,
 * Tuesday and Thursday) is one Schedule with those days. Sequences keep their "Pomodoro N"
 * placeholders; the category's suggested labels are applied when a day is generated, so an
 * exception that changes the category also changes them.
 */
export function templateToSchedules(
  template: WeeklyTemplate = HORARIO_2026.plantilla_semanal,
  sequences: PlanSequences = HORARIO_2026.secuencias_pomodoro,
): TemplateSchedule[] {
  const byKey = new Map<string, TemplateSchedule>();
  const add = (day: number, entry: Omit<TemplateSchedule, 'daysOfWeek'>) => {
    const key = [
      entry.kind,
      entry.startMinute,
      entry.endMinute,
      entry.label,
      entry.category,
      entry.flexibleBlocks,
    ].join('|');
    const existing = byKey.get(key);
    if (existing) existing.daysOfWeek.push(day);
    else byKey.set(key, { ...entry, daysOfWeek: [day] });
  };
  for (const dayKey of ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const) {
    const day = PLAN_DAY_KEYS.indexOf(dayKey);
    for (const block of template[dayKey]) {
      const weekday = dayKey !== 'sabado';
      add(day, {
        kind: 'WORK',
        startMinute: parseClock(block.inicio),
        endMinute: parseClock(block.fin),
        label: block.titulo,
        category: block.categoria,
        sequence: sequenceForTemplateBlock(dayKey, sequences),
        flexibleBlocks: weekday ? 1 : null,
      });
    }
    const breaks = dayKey === 'sabado' ? template.descansos_sabado : template.descansos_lun_vie;
    for (const rest of breaks) {
      add(day, {
        kind: 'REST',
        startMinute: parseClock(rest.inicio),
        endMinute: parseClock(rest.fin),
        label: rest.titulo,
        category: null,
        sequence: null,
        flexibleBlocks: null,
      });
    }
  }
  return [...byKey.values()];
}

export interface WeekdayScheduleLike {
  id: string;
  kind: 'WORK' | 'REST';
  daysOfWeek: number[];
  startMinute: number;
  endMinute: number;
  label?: string | null;
  category?: string | null;
  sequence?: SequenceSegment[] | null;
  flexibleBlocks?: number | null;
  deletedAt?: string | null;
}

export interface WeekdayV2Changes<S extends WeekdayScheduleLike> {
  /** Existing schedules at their new times (same ids), flexible, without a sequence. */
  updates: S[];
  /** The morning's second suggestions, missing until now. */
  creates: Array<Omit<S, 'id'>>;
  /** Schedule ids that go away (the 15:25 break). */
  deletes: string[];
}

const SUGGESTIONS = {
  morning: [
    [9 * 60, 10 * 60 + 30],
    [11 * 60, 12 * 60 + 30],
  ],
  afternoon: [
    [14 * 60, 15 * 60 + 30],
    [16 * 60, 17 * 60 + 30],
  ],
  lunch: [13 * 60, 14 * 60],
} as const;

const isWeekday = (s: Pick<WeekdayScheduleLike, 'daysOfWeek'>) =>
  s.daysOfWeek.some((d) => d >= 1 && d <= 5);

/**
 * Turns an existing timetable into revision 2's weekday (D30), keeping every schedule id so exceptions,
 * completions and history stay attached (re-importing the timetable would delete and recreate every
 * WORK block). A morning study schedule -- 09:30-12:30 from the JSON, or revision 1's 08:00-12:00
 * window -- becomes the 09:00 suggestion and gets an 11:00 sibling; an afternoon block moves to 14:00 or
 * 16:00 by where it was; lunch moves to 13:00; the 15:25 break goes. Saturday isn't touched, and a
 * schedule already where it belongs isn't sent again.
 */
export function weekdayV2Changes<S extends WeekdayScheduleLike>(
  schedules: S[],
): WeekdayV2Changes<S> {
  const live = schedules.filter((s) => !s.deletedAt && isWeekday(s));
  const result: WeekdayV2Changes<S> = { updates: [], creates: [], deletes: [] };
  const place = (s: S, [startMinute, endMinute]: readonly [number, number], flexible: boolean) => {
    const target = flexible ? 1 : null;
    if (
      s.startMinute === startMinute &&
      s.endMinute === endMinute &&
      (s.flexibleBlocks ?? null) === target &&
      (!flexible || !s.sequence)
    ) {
      return;
    }
    result.updates.push({
      ...s,
      startMinute,
      endMinute,
      ...(flexible ? { sequence: null, flexibleBlocks: 1 } : {}),
    });
  };

  for (const s of live) {
    if (s.kind === 'REST') {
      if (s.label === 'Almuerzo') place(s, SUGGESTIONS.lunch, false);
      else if (s.label === 'Descanso' && s.startMinute >= 15 * 60 && s.startMinute < 16 * 60)
        result.deletes.push(s.id);
      continue;
    }
    const morning =
      isPlanCategory(s.category) &&
      MORNING_CATEGORIES.includes(s.category) &&
      s.startMinute < 13 * 60;
    if (morning) {
      const second = s.startMinute >= SUGGESTIONS.morning[1][0];
      place(s, SUGGESTIONS.morning[second ? 1 : 0], true);
      if (!second) {
        const sibling = live.some(
          (o) =>
            o !== s &&
            o.kind === 'WORK' &&
            o.label === s.label &&
            o.category === s.category &&
            o.startMinute === SUGGESTIONS.morning[1][0],
        );
        if (!sibling) {
          const { id: _id, ...rest } = s;
          result.creates.push({
            ...rest,
            startMinute: SUGGESTIONS.morning[1][0],
            endMinute: SUGGESTIONS.morning[1][1],
            sequence: null,
            flexibleBlocks: 1,
          });
        }
      }
    } else {
      // The afternoon: the earlier block (14:00-15:25 until now) is the 14:00 suggestion, the later one 16:00.
      place(s, SUGGESTIONS.afternoon[s.startMinute < 15 * 60 ? 0 : 1], true);
    }
  }
  return result;
}

/** Whether an existing timetable still needs weekdayV2Changes ("Actualizar la jornada"). */
export function needsWeekdayUpdate(schedules: WeekdayScheduleLike[]): boolean {
  const changes = weekdayV2Changes(schedules);
  return changes.updates.length + changes.creates.length + changes.deletes.length > 0;
}

// ─── Exceptions and generation ───────────────────────────────────────────────

export interface PlanScheduleLike {
  id: string;
  kind: 'WORK' | 'REST';
  daysOfWeek: number[];
  startMinute: number;
  endMinute: number;
  label?: string | null;
  enabled?: boolean;
  category?: string | null;
  sequence?: SequenceSegment[] | null;
  flexibleBlocks?: number | null;
}

/** A one-off change to one block on one day; null fields keep the template's value. */
export interface ScheduleExceptionLike {
  scheduleId: string;
  /** YYYY-MM-DD */
  date: string;
  category?: string | null;
  label?: string | null;
  startMinute?: number | null;
  endMinute?: number | null;
  deletedAt?: string | null;
}

/** One block on one day, as the calendar and the timer see it. */
export interface PlanOccurrence {
  scheduleId: string;
  date: string;
  kind: 'WORK' | 'REST';
  startMinute: number;
  endMinute: number;
  title: string;
  category: string | null;
  /** From the week's phase; null outside the plan or for breaks. */
  description: string | null;
  /** The block's sequence, labelled for its category and fitted to its length; null without one. */
  segments: TimedSegment[] | null;
  /** The sequence didn't add up to the block (edited, or the block was moved). */
  sequenceWarning: string | null;
  /** This day differs from the template. */
  isException: boolean;
  /** A flexible window (2026-10-22): blocks started on demand inside it; null for a fixed block. */
  flexibleBlocks: number | null;
}

function exceptionFor(
  exceptions: ScheduleExceptionLike[],
  scheduleId: string,
  date: string,
): ScheduleExceptionLike | null {
  return (
    exceptions.find((e) => e.scheduleId === scheduleId && e.date === date && !e.deletedAt) ?? null
  );
}

/**
 * A schedule as it runs on one day: its times, title and category with that day's exception
 * applied. Same object back when there's none, so callers can use it wherever a schedule goes
 * (the block prompt, blocking, the timer).
 */
export function scheduleOnDate<
  S extends {
    id: string;
    startMinute: number;
    endMinute: number;
    label?: string | null;
    category?: string | null;
  },
>(schedule: S, exceptions: ScheduleExceptionLike[], day: Date | string): S {
  const exception = exceptionFor(
    exceptions,
    schedule.id,
    typeof day === 'string' ? day : localDateKey(day),
  );
  if (!exception) return schedule;
  return {
    ...schedule,
    startMinute: exception.startMinute ?? schedule.startMinute,
    endMinute: exception.endMinute ?? schedule.endMinute,
    label: exception.label ?? schedule.label ?? null,
    category: exception.category ?? schedule.category ?? null,
  };
}

/** A block's sequence with its category's suggested pomodoro labels (none without a plan). */
export function labelledSequenceFor(
  sequence: SequenceSegment[],
  category: string | null | undefined,
  plan: Pick<StudyPlanData, 'pomodoros_sugeridos'> | null,
): SequenceSegment[] {
  return labelSequence(
    sequence,
    plan && isPlanCategory(category) ? plan.pomodoros_sugeridos[category] : undefined,
  );
}

export function occurrencesOnDate(
  schedules: PlanScheduleLike[],
  exceptions: ScheduleExceptionLike[],
  plan: StudyPlanData | null,
  date: string,
): PlanOccurrence[] {
  const dow = dayOfWeekOfKey(date);
  const week = plan ? planWeekOf(plan, date) : 0;
  return schedules
    .filter((schedule) => schedule.enabled !== false && schedule.daysOfWeek.includes(dow))
    .map((schedule) => {
      const day = scheduleOnDate(schedule, exceptions, date);
      const category = day.category ?? null;
      const fitted = schedule.sequence?.length
        ? fitSequence(
            labelledSequenceFor(schedule.sequence, category, plan),
            day.endMinute - day.startMinute,
          )
        : null;
      return {
        scheduleId: schedule.id,
        date,
        kind: schedule.kind,
        startMinute: day.startMinute,
        endMinute: day.endMinute,
        title: day.label ?? '',
        category,
        description:
          plan && schedule.kind === 'WORK' ? blockDescription(plan, category, week) : null,
        segments: fitted?.segments ?? null,
        sequenceWarning: fitted?.warning ?? null,
        isException: day !== schedule,
        flexibleBlocks: schedule.flexibleBlocks ?? null,
      };
    })
    .sort((a, b) => a.startMinute - b.startMinute);
}

export interface PlanWeek {
  week: number;
  /** Monday, YYYY-MM-DD. */
  start: string;
  phase: PlanPhase | null;
  /** Monday to Sunday. */
  days: Array<{ date: string; occurrences: PlanOccurrence[] }>;
  milestones: PlanMilestone[];
}

export function generatePlanWeek(
  schedules: PlanScheduleLike[],
  exceptions: ScheduleExceptionLike[],
  plan: StudyPlanData,
  week: number,
): PlanWeek {
  const start = planWeekStart(plan, week);
  return {
    week,
    start,
    phase: phaseForWeek(plan, week),
    days: Array.from({ length: 7 }, (_, i) => {
      const date = addDaysToKey(start, i);
      return { date, occurrences: occurrencesOnDate(schedules, exceptions, plan, date) };
    }),
    milestones: plan.hitos.filter((hito) => hito.semana === week),
  };
}

/** Every week of the plan (14 from the start Monday). */
export function generatePlan(
  schedules: PlanScheduleLike[],
  exceptions: ScheduleExceptionLike[],
  plan: StudyPlanData,
): PlanWeek[] {
  return Array.from({ length: plan.weeks }, (_, i) =>
    generatePlanWeek(schedules, exceptions, plan, i + 1),
  );
}

// ─── Adjustments (reglas_de_ajuste as quick actions) ─────────────────────────

export interface AdjustmentAction {
  id: string;
  label: string;
  category: PlanCategory;
}

// The rules don't apply themselves: each is a one-tap "move this block to X" that creates an
// exception for that day only.
export const ADJUSTMENT_ACTIONS: AdjustmentAction[] = [
  { id: 'to-carrera', label: 'Mover a carrera', category: 'carrera' },
  { id: 'to-datos', label: 'Mover a datos', category: 'codigo_datos' },
];

/** The actions that make sense for a block: not the category it already has. */
export function adjustmentActionsFor(category: string | null | undefined): AdjustmentAction[] {
  return ADJUSTMENT_ACTIONS.filter((action) => action.category !== category);
}

/**
 * Swapping two blocks of one day exchanges what they're about (category and title); each keeps its
 * own time and sequence, so both still end on time.
 */
export function swapExceptions(
  a: Pick<PlanOccurrence, 'scheduleId' | 'date' | 'category' | 'title'>,
  b: Pick<PlanOccurrence, 'scheduleId' | 'date' | 'category' | 'title'>,
): [ScheduleExceptionLike, ScheduleExceptionLike] {
  return [
    {
      scheduleId: a.scheduleId,
      date: a.date,
      category: b.category,
      label: b.title,
      startMinute: null,
      endMinute: null,
    },
    {
      scheduleId: b.scheduleId,
      date: b.date,
      category: a.category,
      label: a.title,
      startMinute: null,
      endMinute: null,
    },
  ];
}

// ─── Milestones ──────────────────────────────────────────────────────────────

export interface MilestoneTask {
  /** Stable id so importing twice doesn't duplicate them. */
  clientId: string;
  title: string;
  category: PlanCategory;
  /** Monday of the milestone's week. */
  date: string;
}

/** Milestones as checkbox tasks on the Monday of their week. */
export function milestoneTasks(plan: StudyPlanData): MilestoneTask[] {
  return plan.hitos.map((hito, i) => ({
    clientId: `hito:${hito.semana}:${i}`,
    title: hito.titulo,
    category: hito.categoria,
    date: planWeekStart(plan, hito.semana),
  }));
}

// ─── Progress ────────────────────────────────────────────────────────────────

export interface ProgressSessionLike {
  scheduleId?: string | null;
  blockStartAt?: string | null;
  startedAt?: string | null;
  createdAt?: string | null;
  completedCycles: number;
  cutCount?: number | null;
}

export interface WeekProgress {
  /** Completed focus pomodoros per category. */
  pomodorosByCategory: Record<string, number>;
  /** Times "cortar tramo" was used. */
  cuts: number;
}

/** Pomodoros by category and "cortar tramo" uses in the 7 days from `weekStart` (a Monday). */
export function weekProgress(
  sessions: ProgressSessionLike[],
  schedules: PlanScheduleLike[],
  exceptions: ScheduleExceptionLike[],
  weekStart: string,
): WeekProgress {
  const weekEnd = addDaysToKey(weekStart, 7);
  const result: WeekProgress = { pomodorosByCategory: {}, cuts: 0 };
  for (const session of sessions) {
    if (!session.scheduleId) continue;
    const when = session.blockStartAt ?? session.startedAt ?? session.createdAt;
    if (!when) continue;
    const date = localDateKey(new Date(when));
    if (date < weekStart || date >= weekEnd) continue;
    const schedule = schedules.find((s) => s.id === session.scheduleId);
    const category =
      exceptionFor(exceptions, session.scheduleId, date)?.category ?? schedule?.category;
    if (!category) continue;
    result.pomodorosByCategory[category] =
      (result.pomodorosByCategory[category] ?? 0) + session.completedCycles;
    result.cuts += session.cutCount ?? 0;
  }
  return result;
}
