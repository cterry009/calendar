import { blockOnDay, type AttentionProfile } from '@calendar/shared';
import type { SyncTaskRecord } from '../calendar/types';

/** Today (or `base`'s day) at a minute of the day, local time. */
export function localDateAt(minute: number, base: Date = new Date()): Date {
  const d = new Date(base);
  d.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
  return d;
}

export interface BlockToday {
  scheduleId: string;
  startAt: Date;
  /** The real end: 60 minutes for a mechanical block, the schedule's end otherwise. */
  endAt: Date;
  /** Pending tasks placed in this block that day, in calendar order. */
  tasks: SyncTaskRecord[];
  /** The block's attention profile: its most demanding task's, LIGHT when none is rated. */
  profile: AttentionProfile;
}

/** A WORK block on `day` (default today); same rules as the desktop (packages/shared blockOnDay). */
export function blockToday(
  block: { scheduleId: string; startMinute: number; endMinute: number },
  tasks: SyncTaskRecord[],
  day: Date = new Date(),
): BlockToday {
  return { scheduleId: block.scheduleId, ...blockOnDay(block, tasks, day) };
}
