import * as Crypto from 'expo-crypto';
import {
  labelledSequenceFor,
  localDateKey,
  WAKE_EXERCISE_HABIT_TITLE,
  milestoneTaskChanges,
  timetableImportBatch,
  scheduleOnDate,
  type ScheduleExceptionLike,
  type SequenceSegment,
  type StudyPlanData,
} from '@calendar/shared';
import type { SyncScheduleException, SyncSnapshot } from '../calendar/types';
import { getCachedSnapshot } from '../offline/db';
import { pullSnapshot, syncBatch } from '../sync/api';

// Horario 2026-10-19, phone side (ported from apps/web/src/lib/plan/sync.ts): one-off changes to a
// block on one day, and the block's pomodoro sequence when it starts.

/** Snapshot rows as the shared plan code takes them: `date` as YYYY-MM-DD. */
export function toExceptionLikes(rows: SyncScheduleException[] | undefined): ScheduleExceptionLike[] {
  return (rows ?? []).map((row) => ({
    scheduleId: row.scheduleId,
    date: row.date.slice(0, 10),
    category: row.category,
    label: row.label,
    startMinute: row.startMinute,
    endMinute: row.endMinute,
  }));
}

export function planOf(snapshot: Pick<SyncSnapshot, 'studyPlan'>): StudyPlanData | null {
  return snapshot.studyPlan?.planData ?? null;
}

export async function saveScheduleException(exception: ScheduleExceptionLike, clientId: string): Promise<void> {
  await syncBatch({
    scheduleExceptions: [
      {
        clientId,
        updatedAt: new Date().toISOString(),
        scheduleId: exception.scheduleId,
        date: exception.date,
        category: exception.category ?? null,
        label: exception.label ?? null,
        startMinute: exception.startMinute ?? null,
        endMinute: exception.endMinute ?? null,
      },
    ],
  });
}

export async function clearScheduleException(scheduleId: string, date: string): Promise<void> {
  await syncBatch({ scheduleExceptions: [{ updatedAt: new Date().toISOString(), deleted: true, scheduleId, date }] });
}

export interface SequenceBlock {
  sequence: SequenceSegment[];
  startAt: Date;
  endAt: Date;
}

/**
 * The sequence a block runs on `day`, labelled for that day's category, and its real start and end
 * (moved by an exception, if any). Null for a block without a sequence. Read from the cached
 * snapshot (no network wait when a block starts), pulled only when there's none yet. Every place
 * that starts a block (prompt, auto-start, "volver", missed blocks, the timer screen) goes through
 * PomodoroContext.startBlock, which calls this -- so none of them has to know about sequences.
 */
export async function sequenceBlockFor(scheduleId: string, day: Date): Promise<SequenceBlock | null> {
  const snapshot = (await getCachedSnapshot()) ?? (await pullSnapshot());
  const schedule = snapshot.schedules.find((s) => s.id === scheduleId);
  if (!schedule?.sequence?.length) return null;
  const today = scheduleOnDate(schedule, toExceptionLikes(snapshot.scheduleExceptions), day);
  const at = (minute: number) => {
    const d = new Date(day);
    d.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
    return d;
  };
  return {
    sequence: labelledSequenceFor(schedule.sequence, today.category, planOf(snapshot)),
    startAt: at(today.startMinute),
    endAt: at(today.endMinute),
  };
}

/**
 * Loading the timetable from the phone: the same payloads as the desktop's (packages/shared
 * plan/importBatch.ts), read from a fresh snapshot so the old WORK blocks it deletes are the real
 * ones. Schedules first, then the plan, milestones and the wake-up exercise habit.
 */
export async function importTimetable(startDate: string): Promise<void> {
  const snapshot = await pullSnapshot();
  const batch = timetableImportBatch({
    startDate,
    schedules: snapshot.schedules,
    tasks: snapshot.tasks,
    habits: snapshot.habits ?? [],
    now: new Date().toISOString(),
    newId: () => Crypto.randomUUID(),
  });
  await syncBatch({ schedules: batch.schedules });
  await syncBatch({ studyPlan: batch.studyPlan, tasks: batch.tasks, habits: batch.habits });
}

/** A new start Monday: the plan is saved and the milestones move to their new Mondays. */
export async function changePlanStart(plan: StudyPlanData, startDate: string): Promise<void> {
  const snapshot = await pullSnapshot();
  const next = { ...plan, startDate };
  const tasks = milestoneTaskChanges(next, snapshot.tasks, new Date().toISOString());
  await syncBatch({ studyPlan: [{ updatedAt: new Date().toISOString(), planData: next }], ...(tasks.length ? { tasks } : {}) });
}

/**
 * "Sí, ya hice" on the morning "¿Ya hiciste ejercicio?" card (native, 2026-10-15): ticks the
 * "Ejercicio al despertar" habit for that day. It doesn't unlock anything -- the jog / steps rule
 * does that natively.
 */
export async function recordWakeExercise(occurredAt: string): Promise<void> {
  const snapshot = (await getCachedSnapshot()) ?? (await pullSnapshot());
  const habit = (snapshot.habits ?? []).find((h) => h.title === WAKE_EXERCISE_HABIT_TITLE && !h.archived);
  if (!habit) return;
  await syncBatch({
    habitRecords: [
      {
        clientId: Crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
        habitId: habit.id,
        date: localDateKey(new Date(occurredAt)),
        value: 1,
        status: 'DONE',
      },
    ],
  });
}

/** The night window edited on the phone goes into the plan, so the PC takes it too. */
export async function saveNightWindowToPlan(window: {
  startMinutes: number;
  endMinutes: number;
  weekendStartMinutes: number;
}): Promise<void> {
  const plan = planOf(await pullSnapshot());
  if (!plan) return;
  await syncBatch({ studyPlan: [{ updatedAt: new Date().toISOString(), planData: { ...plan, nightWindow: window } }] });
}
