import type { FocusEvent } from '@calendar/shared';
import { syncBatch } from '../offline/sync-client';

// Focus-block telemetry, same events the phone logs (server FocusEvent): prompt answers, every
// pomodoro transition, with when the block was due. Fire-and-forget through the offline-aware
// sync batch, so an event logged offline still arrives.
export type FocusEventInput = Omit<FocusEvent, 'id' | 'occurredAt'> & { occurredAt?: string };

export function logFocusEvent(event: FocusEventInput): void {
  const payload: FocusEvent = { id: crypto.randomUUID(), occurredAt: new Date().toISOString(), ...event };
  void syncBatch({ focusEvents: [payload] }).catch(() => {
    // Nothing worth surfacing to the user.
  });
}
