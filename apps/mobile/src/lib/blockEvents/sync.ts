import type { NativePendingBlockEvent } from '../../../modules/focus-block/src/FocusBlock.types';
import { syncBatch } from '../sync/api';

// Task 8.2. Native events arrive already shaped like the server DTO (id/identifier/scope/
// trigger/occurredAt, see FocusBlockPrefs.kt's drainPendingBlockEvents) -- no mapping needed
// beyond handing the array straight to syncBatch, which already handles the online/offline-queue
// split every other domain's sync call goes through (lib/sync/api.ts).
export async function syncBlockEventBatch(events: NativePendingBlockEvent[]): Promise<void> {
  if (events.length === 0) return;
  await syncBatch({ blockEvents: events });
}
