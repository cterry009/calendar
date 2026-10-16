import type { ScheduleExceptionLike, StudyPlanData } from '@calendar/shared';
import { syncBatch } from '../offline/sync-client';
import type { SyncScheduleException } from '../calendar/types';

// Horario 2026-10-19: the study plan (one per user) and one-off changes to a block on one day.

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

export async function saveStudyPlan(planData: StudyPlanData): Promise<void> {
  await syncBatch({ studyPlan: [{ updatedAt: new Date().toISOString(), planData }] });
}

/** Creates or replaces that day's exception for the block (one per block and day). */
export async function saveScheduleException(exception: ScheduleExceptionLike): Promise<void> {
  await syncBatch({
    scheduleExceptions: [
      {
        clientId: crypto.randomUUID(),
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

/** Back to the template for that day. */
export async function clearScheduleException(scheduleId: string, date: string): Promise<void> {
  await syncBatch({
    scheduleExceptions: [{ updatedAt: new Date().toISOString(), deleted: true, scheduleId, date }],
  });
}
