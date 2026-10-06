import { syncBatch } from '../offline/sync-client';
import { buildCheckInPayload, buildDeleteCheckInPayload } from '../habits/sync';
import { dateKey } from '../habits/today';
import type { CalendarEvent } from './types';

// "Marcar como hecho" for any calendar block. Work/rest blocks write a ScheduleCompletion (block +
// day); habit blocks write that day's HabitRecord, the same record the Habits page checks in, so
// ticking a habit on the calendar and on the Habits page are one and the same.

/** Whether this event can be marked done at all. */
export function isCompletable(event: CalendarEvent): boolean {
  return (
    ((event.type === 'work' || event.type === 'rest') && Boolean(event.meta?.scheduleId)) ||
    (event.type === 'habit' && Boolean(event.meta?.habitId))
  );
}

/**
 * "No puedo hacer este bloque" for a work block on its day, or undo it (2026-10-06): no overlay,
 * no auto-started pomodoro and no work-hours blocking for it that day, on every device.
 */
export async function toggleEventSkipped(event: CalendarEvent): Promise<void> {
  const scheduleId = event.meta?.scheduleId;
  if (event.type !== 'work' || !scheduleId) return;
  const day = dateKey(event.start);
  const now = new Date().toISOString();
  await syncBatch({
    scheduleCompletions: [
      event.meta?.skipped
        ? { updatedAt: now, deleted: true, scheduleId, date: day }
        : { clientId: crypto.randomUUID(), updatedAt: now, scheduleId, date: day, status: 'SKIPPED' },
    ],
  });
  if (!event.meta?.skipped) {
    await syncBatch({
      focusEvents: [
        { id: crypto.randomUUID(), occurredAt: now, kind: 'BLOCK_SKIPPED', scheduleId, meta: { day } },
      ],
    });
  }
}

/** Flips the event's done state for its own day. */
export async function toggleEventDone(event: CalendarEvent): Promise<void> {
  const day = dateKey(event.start);
  const done = Boolean(event.meta?.done);
  const now = new Date().toISOString();

  if (event.type === 'habit' && event.meta?.habitId) {
    const recordId = event.meta.habitRecordId;
    const change = done && recordId
      ? buildDeleteCheckInPayload(recordId)
      : buildCheckInPayload(event.meta.habitId, { date: day, value: 1, status: 'DONE' }, recordId);
    await syncBatch({ habitRecords: [change] });
    return;
  }

  if (event.meta?.scheduleId) {
    await syncBatch({
      scheduleCompletions: [
        done
          ? { updatedAt: now, deleted: true, scheduleId: event.meta.scheduleId, date: day }
          : { clientId: crypto.randomUUID(), updatedAt: now, scheduleId: event.meta.scheduleId, date: day },
      ],
    });
  }
}
