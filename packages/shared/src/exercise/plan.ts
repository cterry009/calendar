// The morning exercise plan (morning-exercise-routine, 2026-11-08): what each morning is, which routine
// day comes next and how long the session is, from the prescription (prescription.ts).

import { dayOfWeekOfKey } from '../plan/plan.js';
import { PRESCRIPTION, type RoutineDay } from './prescription.js';

// The user starts the routine on Monday 2026-11-09 (said 2026-11-08): week 1 of the progression.
export const EXERCISE_PLAN_START = '2026-11-09';

export type MorningExerciseKind = 'rutina' | 'trote' | 'movilidad' | 'descanso';

/** 0 = Sunday … 6 = Saturday, the Schedule.daysOfWeek convention. */
export const MORNING_EXERCISE_BY_WEEKDAY: Record<number, MorningExerciseKind> = {
  0: 'descanso',
  1: 'rutina',
  2: 'trote',
  3: 'rutina',
  4: 'trote',
  5: 'rutina',
  6: 'movilidad',
};

export interface MorningExercise {
  date: string;
  kind: MorningExerciseKind;
  /** Saturday's mobility and stretching is optional; nothing is missed without it. */
  optional: boolean;
  /** Routine days only: the prescription's day to do next. */
  routine: RoutineDay | null;
  plannedMinutes: number;
  intensity: 'leve' | 'moderada' | null;
  /** 1 from the plan's start Monday; 0 before it. */
  week: number;
}

const DAY_MS = 86_400_000;
const keyMs = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

export function exerciseWeek(startMonday: string, date: string): number {
  const diff = Math.floor((keyMs(date) - keyMs(startMonday)) / DAY_MS);
  return diff < 0 ? 0 : Math.floor(diff / 7) + 1;
}

/**
 * Session length by plan week: 45 min in weeks 1-2 (light), then +5 per week up to 60 (the
 * prescription's 45-60 min and "+5 minutos por semana"). A jog is cardio, capped at 30 min by the
 * prescription: 20 in weeks 1-2, then +5 per week up to 30.
 */
export function plannedMinutes(kind: MorningExerciseKind, week: number): number {
  const w = Math.max(week, 1);
  const extra = Math.max(0, w - 2) * 5;
  if (kind === 'rutina') return Math.min(60, 45 + extra);
  if (kind === 'trote') return Math.min(30, 20 + extra);
  if (kind === 'movilidad') return 20;
  return 0;
}

/**
 * The next routine day: Día 1 → Día 5 in turn, by how many routine sessions were done (a missed
 * Monday doesn't skip a routine). Ended-for-pain sessions don't count as done.
 */
export function nextRoutineDay(routineSessionsDone: number): RoutineDay {
  const days = PRESCRIPTION.dias;
  return days[((routineSessionsDone % days.length) + days.length) % days.length];
}

export function morningExerciseFor(
  date: string,
  startMonday: string,
  routineSessionsDone: number,
): MorningExercise {
  const kind = MORNING_EXERCISE_BY_WEEKDAY[dayOfWeekOfKey(date)];
  const week = exerciseWeek(startMonday, date);
  return {
    date,
    kind,
    optional: kind === 'movilidad',
    routine: kind === 'rutina' ? nextRoutineDay(routineSessionsDone) : null,
    plannedMinutes: plannedMinutes(kind, week),
    intensity: kind === 'descanso' ? null : week <= 2 ? 'leve' : 'moderada',
    week,
  };
}

/** The morning question on the phone, by day (replaces "¿Ya hiciste ejercicio?"). */
export function morningExerciseQuestion(exercise: MorningExercise): string {
  switch (exercise.kind) {
    case 'rutina':
      return '¿Ya hiciste los ejercicios básicos?';
    case 'trote':
      return '¿Ya saliste a trotar?';
    case 'movilidad':
      return '¿Hiciste la movilidad y el estiramiento?';
    default:
      return 'Hoy es descanso';
  }
}
