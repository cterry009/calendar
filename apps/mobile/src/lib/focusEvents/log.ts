import type { FocusEvent } from '@calendar/shared';
import * as Crypto from 'expo-crypto';
import { syncBatch } from '../sync/api';

// Focus-block telemetry: every prompt answer and every pomodoro transition, with when the block was
// due, so later we can see how late blocks start, how often they're cut short, and how each
// attention profile actually holds up. Fire-and-forget through the same queue every other sync
// call uses, so an event logged offline still arrives.
export type FocusEventInput = Omit<FocusEvent, 'id' | 'occurredAt'> & { occurredAt?: string };

export function logFocusEvent(event: FocusEventInput): void {
  const payload: FocusEvent = { id: Crypto.randomUUID(), occurredAt: new Date().toISOString(), ...event };
  void syncBatch({ focusEvents: [payload] }).catch(() => {
    // syncBatch already queues on failure; anything left is not worth surfacing to the user.
  });
}
