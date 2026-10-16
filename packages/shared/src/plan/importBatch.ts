// Loading the timetable (horario 2026-10-19), as sync-batch payloads both clients send as they are
// (web lib/plan/importTimetable.ts, mobile lib/plan/api.ts) so the PC and the phone load it the
// same way: the weekly template replaces the user's WORK blocks (agreed 2026-10-15: the old 40/10
// blocks are deleted, not kept disabled), breaks and lunch become REST blocks, the plan is saved,
// each milestone becomes a task on the Monday of its week, and the wake-up exercise habit is added.

import { defaultStudyPlanData, milestoneTasks, templateToSchedules, type StudyPlanData } from './plan.js';

/** Milestones sit after the day's blocks, so they don't take a pomodoro slot inside one. */
const MILESTONE_HOUR = 17;

// Exercise right after waking (2026-10-15): the night window ends at 08:00 and the phone keeps the
// night list blocked until a jog or 1500 steps (FocusBlockAccessibilityService, by 09:30 at the
// latest). On the calendar it's this habit, 08:00-09:00 Monday to Saturday, ticked by itself when
// the phone detects a jog (same 'Trote' link as the mobile "Deporte / trotar" template).
export const WAKE_EXERCISE_HABIT_TITLE = 'Ejercicio al despertar';
const JOG_ACTIVITY_TYPE = 'Trote';

export interface ImportScheduleLike {
  id: string;
  kind: 'WORK' | 'REST';
}

export interface ImportTaskLike {
  id: string;
  clientId: string | null;
  title: string;
  description?: string | null;
  scheduledAt: string | null;
  estimatedMinutes: number;
  priority: string;
  status: string;
  deletedAt?: string | null;
}

export interface TimetableBatch {
  schedules: Record<string, unknown>[];
  studyPlan: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  habits: Record<string, unknown>[];
}

function milestoneScheduledAt(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, MILESTONE_HOUR, 0).toISOString();
}

/**
 * Milestone tasks for the plan: created once (stable clientId "hito:<week>:<n>"), moved to the
 * right Monday when the start date changes. Done ones are left alone.
 */
export function milestoneTaskChanges(plan: StudyPlanData, tasks: ImportTaskLike[], now: string): Record<string, unknown>[] {
  return milestoneTasks(plan).flatMap((milestone): Record<string, unknown>[] => {
    const scheduledAt = milestoneScheduledAt(milestone.date);
    const existing = tasks.find((t) => t.clientId === milestone.clientId && !t.deletedAt);
    if (!existing) {
      return [
        {
          clientId: milestone.clientId,
          updatedAt: now,
          title: milestone.title,
          description: 'Hito del plan',
          scheduledAt,
          estimatedMinutes: 25,
          category: milestone.category,
          priority: 'HIGH',
          status: 'PENDING',
        },
      ];
    }
    if (existing.status === 'COMPLETED' || existing.scheduledAt === scheduledAt) return [];
    return [
      {
        // A task update rewrites every field, so the ones kept are sent as they are.
        id: existing.id,
        updatedAt: now,
        title: existing.title,
        description: existing.description ?? undefined,
        scheduledAt,
        estimatedMinutes: existing.estimatedMinutes,
        category: milestone.category,
        priority: existing.priority,
        status: existing.status,
      },
    ];
  });
}

export function timetableImportBatch(input: {
  startDate: string;
  schedules: ImportScheduleLike[];
  tasks: ImportTaskLike[];
  habits: Array<{ title: string; deletedAt?: string | null }>;
  now: string;
  newId: () => string;
}): TimetableBatch {
  const { now } = input;
  const plan = defaultStudyPlanData(input.startDate);
  const hasExerciseHabit = input.habits.some((h) => h.title === WAKE_EXERCISE_HABIT_TITLE && !h.deletedAt);
  return {
    schedules: [
      ...input.schedules.filter((s) => s.kind === 'WORK').map((s) => ({ id: s.id, deleted: true, updatedAt: now })),
      ...templateToSchedules().map((s) => ({
        updatedAt: now,
        kind: s.kind,
        daysOfWeek: s.daysOfWeek,
        startMinute: s.startMinute,
        endMinute: s.endMinute,
        label: s.label,
        enabled: true,
        category: s.category,
        sequence: s.sequence,
      })),
    ],
    studyPlan: [{ updatedAt: now, planData: plan }],
    tasks: milestoneTaskChanges(plan, input.tasks, now),
    habits: hasExerciseHabit
      ? []
      : [
          {
            clientId: input.newId(),
            updatedAt: now,
            title: WAKE_EXERCISE_HABIT_TITLE,
            description: 'Trotar o caminar apenas te despiertas: el celular desbloquea la lista nocturna con un trote o 1500 pasos.',
            type: 'NORMAL',
            dailyGoalValue: 1,
            dailyGoalUnit: 'vez',
            targetDays: 66,
            category: 'Salud',
            linkedFitnessActivityType: JOG_ACTIVITY_TYPE,
            reminderStartMinute: 8 * 60,
            reminderEndMinute: 9 * 60,
            reminderDaysOfWeek: [1, 2, 3, 4, 5, 6],
          },
        ],
  };
}
