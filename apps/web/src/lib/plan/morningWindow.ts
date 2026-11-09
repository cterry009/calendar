import { afternoonV3Changes, weekdayV2Changes } from '@calendar/shared';
import {
  buildCreateSchedulePayload,
  buildDeleteSchedulePayload,
  buildUpdateSchedulePayload,
  mapSyncSchedule,
  syncScheduleBatch,
  type ScheduleSyncChangeDto,
} from '../schedules/sync';
import type { SyncScheduleRecord } from '../schedules/types';

/**
 * The batch for "Actualizar la jornada" (dynamic-study-blocks D30, revision 2): every weekday block a
 * flexible suggestion at its new time (same ids), the morning's second suggestions created, lunch at
 * 13:00, the 15:25 break deleted. The server needs a schedule's whole shape on an update, so each
 * change is the schedule as it is with the new times laid over.
 */
export function weekdayPayloads(schedules: SyncScheduleRecord[]): ScheduleSyncChangeDto[] {
  const { updates, creates, deletes } = weekdayV2Changes(schedules);
  const values = (s: Omit<SyncScheduleRecord, 'id'>) => ({
    ...mapSyncSchedule({ ...s, id: '' }),
    category: s.category ?? null,
    sequence: s.sequence ?? null,
    flexibleBlocks: s.flexibleBlocks ?? null,
  });
  return [
    ...updates.map((s) => buildUpdateSchedulePayload(s.id, values(s))),
    ...creates.map((s) => buildCreateSchedulePayload(values(s))),
    ...deletes.map((id) => buildDeleteSchedulePayload(id)),
  ];
}

export async function applyWeekday(schedules: SyncScheduleRecord[]): Promise<number> {
  const payloads = weekdayPayloads(schedules);
  await syncScheduleBatch(payloads);
  return payloads.length;
}

/**
 * The batch for "Actualizar las tardes" (afternoon v3, 2026-11-08): the weekday afternoons of the new
 * template laid over the existing schedules (same ids where possible), new blocks created, and a block
 * left without a place disabled rather than deleted, so its completions stay.
 */
export function afternoonPayloads(schedules: SyncScheduleRecord[]): ScheduleSyncChangeDto[] {
  const { updates, creates, disables } = afternoonV3Changes(schedules);
  const values = (s: Omit<SyncScheduleRecord, 'id'>) => ({
    ...mapSyncSchedule({ ...s, id: '' }),
    category: s.category ?? null,
    sequence: s.sequence ?? null,
    flexibleBlocks: s.flexibleBlocks ?? null,
  });
  return [
    ...updates.map((s) => buildUpdateSchedulePayload(s.id, values(s))),
    ...creates.map((s) => buildCreateSchedulePayload(values(s))),
    ...disables.map((s) => buildUpdateSchedulePayload(s.id, { ...values(s), enabled: false })),
  ];
}

export async function applyAfternoons(schedules: SyncScheduleRecord[]): Promise<number> {
  const payloads = afternoonPayloads(schedules);
  await syncScheduleBatch(payloads);
  return payloads.length;
}
