import { blockOccurrenceKey, localDayKey } from '@calendar/shared';
import * as Crypto from 'expo-crypto';
import { logFocusEvent } from '../focusEvents/log';
import { syncBatch } from '../sync/api';
import type { SyncScheduleCompletion } from './types';

// "No puedo hacer este bloque" (user-requested, 2026-10-06): a ScheduleCompletion with status
// SKIPPED for that day. A skipped block gets no prompt, no overlay, no blocking and isn't counted
// as missed, on every device.

/** blockOccurrenceKey of every block marked "no puedo" (the date is that day's UTC midnight). */
export function skippedBlockKeys(completions: SyncScheduleCompletion[] | undefined): Set<string> {
  return new Set(
    (completions ?? []).filter((c) => c.status === 'SKIPPED').map((c) => `${c.scheduleId}@${c.date.slice(0, 10)}`),
  );
}

export async function markBlockSkipped(scheduleId: string, day: Date, reason?: string): Promise<void> {
  await syncBatch({
    scheduleCompletions: [
      {
        clientId: Crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
        scheduleId,
        date: localDayKey(day),
        status: 'SKIPPED',
        reason: reason?.trim() || null,
      },
    ],
  });
  logFocusEvent({ kind: 'BLOCK_SKIPPED', scheduleId, meta: { day: localDayKey(day), reason: reason?.trim() || undefined } });
}

/** Undo "no puedo" (or "hecho") for that day. */
export async function clearBlockMark(scheduleId: string, day: Date): Promise<void> {
  await syncBatch({
    scheduleCompletions: [{ updatedAt: new Date().toISOString(), deleted: true, scheduleId, date: localDayKey(day) }],
  });
}

export { blockOccurrenceKey };
