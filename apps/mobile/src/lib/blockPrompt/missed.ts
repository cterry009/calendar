import type { SyncScheduleCompletion, SyncScheduleRecord } from '../calendar/types';
import { dateKey } from '../habits/today';
import type { SyncPomodoroRecord } from '../pomodoro/types';
import { localDateAt } from './block';

// WORK blocks that came and went without a pomodoro (user-requested, 2026-10-05): when the app
// opens it says which blocks weren't started since it last looked, so a block whose prompt was
// missed, dismissed or never shown doesn't just vanish.

/** A block counts as missed once it has been running this long with nothing started. */
export const MISSED_GRACE_MS = 5 * 60_000;
/** A session started this early still belongs to the block (the "En 5 min" crowd starts early too). */
const EARLY_START_MS = 15 * 60_000;
/** How far back a first look (or a long absence) reports. */
export const MISSED_LOOKBACK_DAYS = 7;

export interface MissedBlock {
  scheduleId: string;
  label: string | null;
  startAt: Date;
  endAt: Date;
  /** Still inside its window: it can be started now. */
  running: boolean;
}

function sessionSpan(session: SyncPomodoroRecord, now: number): [number, number] | null {
  const times = [session.createdAt, session.startedAt].filter((t): t is string => !!t).map((t) => new Date(t).getTime());
  if (!times.length) return null;
  const from = Math.min(...times);
  const to = session.active ? now : new Date(session.endedAt ?? session.updatedAt).getTime();
  return [from, Math.max(from, to)];
}

/** WORK blocks that started in [since, now - grace] with no pomodoro over them and not marked done. */
export function missedBlocks(input: {
  schedules: SyncScheduleRecord[];
  sessions: SyncPomodoroRecord[];
  completions: SyncScheduleCompletion[];
  since: Date;
  now?: Date;
}): MissedBlock[] {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const spans = input.sessions
    // A session that never left IDLE never ran.
    .filter((s) => s.startedAt)
    .map((s) => sessionSpan(s, nowMs))
    .filter((s): s is [number, number] => s !== null);
  const done = new Set(input.completions.map((c) => `${c.scheduleId}@${dateKey(c.date)}`));
  // A flexible morning window (2026-10-22) has no start to miss: its blocks start on demand.
  const work = input.schedules.filter((s) => s.kind === 'WORK' && s.enabled && !s.flexibleBlocks);

  const missed: MissedBlock[] = [];
  const first = new Date(input.since.getFullYear(), input.since.getMonth(), input.since.getDate());
  for (let day = first; day.getTime() <= nowMs; day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)) {
    for (const s of work) {
      if (!s.daysOfWeek.includes(day.getDay())) continue;
      const startAt = localDateAt(s.startMinute, day);
      const endAt = localDateAt(s.endMinute, day);
      if (startAt < input.since || startAt.getTime() > nowMs - MISSED_GRACE_MS) continue;
      if (done.has(`${s.id}@${dateKey(day)}`)) continue;
      const from = startAt.getTime() - EARLY_START_MS;
      if (spans.some(([a, b]) => a < endAt.getTime() && b > from)) continue;
      missed.push({ scheduleId: s.id, label: s.label, startAt, endAt, running: nowMs < endAt.getTime() });
    }
  }
  return missed.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}
