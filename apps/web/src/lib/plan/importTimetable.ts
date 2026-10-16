import { milestoneTaskChanges, timetableImportBatch, type StudyPlanData } from '@calendar/shared';
import { syncBatch } from '../offline/sync-client';
import type { SyncScheduleRecord } from '../schedules/types';
import type { SyncTaskRecord } from '../tasks/types';

// Loading the timetable (horario 2026-10-19): the payloads come from packages/shared
// plan/importBatch.ts, the same the phone sends. Schedules first: the plan's blocks must exist
// before anything refers to them.
export async function importTimetable(input: {
  startDate: string;
  schedules: SyncScheduleRecord[];
  tasks: SyncTaskRecord[];
  habits: Array<{ title: string; deletedAt?: string | null }>;
}): Promise<void> {
  const batch = timetableImportBatch({ ...input, now: new Date().toISOString(), newId: () => crypto.randomUUID() });
  await syncBatch({ schedules: batch.schedules });
  await syncBatch({ studyPlan: batch.studyPlan, tasks: batch.tasks, habits: batch.habits });
}

/** After the start date changes: milestones move to their new Mondays. */
export async function syncMilestoneTasks(plan: StudyPlanData, tasks: SyncTaskRecord[]): Promise<void> {
  const changes = milestoneTaskChanges(plan, tasks, new Date().toISOString());
  if (changes.length) await syncBatch({ tasks: changes });
}
