import { blockOnDay, currentStudySession, type AttentionProfile } from '@calendar/shared';
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
  /** Its pomodoro and break: the rated tasks' profile, else the block's own configuration. */
  focusMin: number;
  breakMin: number;
  timingSource: 'tasks' | 'schedule' | 'default';
}

/** A WORK block on `day` (default today); same rules as the desktop (packages/shared blockOnDay). */
export function blockToday(
  block: { scheduleId: string; startMinute: number; endMinute: number; pomodoroMin?: number | null; shortBreakMin?: number | null },
  tasks: SyncTaskRecord[],
  day: Date = new Date(),
): BlockToday {
  return { scheduleId: block.scheduleId, ...blockOnDay(block, tasks, day) };
}

/**
 * The task a block's pomodoro works on: one the weekly plan placed in the block, else -- for a study
 * block -- the next pending session of its lines (a session not finished stays next, so it moves to
 * the following block of that line by itself).
 */
export function blockTaskId(block: Pick<BlockToday, 'tasks'>, label: string | null | undefined, tasks: SyncTaskRecord[]): string | null {
  return block.tasks[0]?.id ?? currentStudySession(label, tasks)?.id ?? null;
}
