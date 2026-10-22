import { morningWindowChanges } from '@calendar/shared';
import {
  buildUpdateSchedulePayload,
  mapSyncSchedule,
  syncScheduleBatch,
  type ScheduleSyncChangeDto,
} from '../schedules/sync';
import type { SyncScheduleRecord } from '../schedules/types';

/**
 * The updates for "Actualizar la mañana" (dynamic-study-blocks D2): the morning study blocks become
 * the 08:00-12:00 window in place, keeping their ids. The server needs a schedule's whole shape on an
 * update, so each change is laid over the schedule as it is.
 */
export function morningWindowPayloads(
  schedules: SyncScheduleRecord[],
  now: Date = new Date(),
): ScheduleSyncChangeDto[] {
  return morningWindowChanges(schedules, now.toISOString()).map((change) => {
    const schedule = schedules.find((s) => s.id === change.id)!;
    return buildUpdateSchedulePayload(schedule.id, {
      ...mapSyncSchedule(schedule),
      category: schedule.category ?? null,
      startMinute: change.startMinute as number,
      endMinute: change.endMinute as number,
      sequence: null,
      flexibleBlocks: change.flexibleBlocks as number,
    });
  });
}

export async function applyMorningWindow(schedules: SyncScheduleRecord[]): Promise<number> {
  const payloads = morningWindowPayloads(schedules);
  await syncScheduleBatch(payloads);
  return payloads.length;
}
