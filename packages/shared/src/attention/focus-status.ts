import type { PomodoroSession } from '../schemas/pomodoro.js';
import { currentSegment, getPhaseDurationMinutes } from '../pomodoro/state-machine.js';
import { scheduleOnDate, type ScheduleExceptionLike } from '../plan/plan.js';
import type { SequenceSegment } from '../plan/sequence.js';
import { ATTENTION_PROFILE_SPECS, blockOnDay, type BlockTaskLike } from './profiles.js';

// What the persistent "you're working" indicator says -- the phone's ongoing notification and the
// desktop's tray -- so both show the same thing (user-requested, 2026-10-02): whenever a pomodoro
// or a WORK schedule is running, how long is left and which block it is.

export interface FocusStatusSchedule {
  id: string;
  kind: string;
  enabled: boolean;
  daysOfWeek: number[];
  startMinute: number;
  endMinute: number;
  label: string | null;
  category?: string | null;
  sequence?: SequenceSegment[] | null;
}

export type FocusStatusTask = BlockTaskLike & { id: string; title: string };

export interface FocusStatus {
  kind: 'pomodoro' | 'schedule';
  /** e.g. "Enfoque · Profundo" or "Horario de trabajo". */
  title: string;
  /** e.g. "Estudio B1 · 02 · Teorema de Darboux · ciclo 2". */
  text: string;
  /** When the current phase (pomodoro) or block (schedule) ends: the countdown target. */
  endsAt: Date;
  /** The WORK block running now, if any. */
  blockLabel: string | null;
  /** Changes exactly when the indicator should announce something new (a phase or block starts). */
  key: string;
}

const PHASES: Record<string, string> = {
  FOCUS: 'Enfoque',
  SHORT_BREAK: 'Pausa',
  LONG_BREAK: 'Pausa larga',
};

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Local YYYY-MM-DD of a date: the day a block occurrence belongs to. */
export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** One day's occurrence of a block: "<scheduleId>@<YYYY-MM-DD>". */
export function blockOccurrenceKey(scheduleId: string, day: Date): string {
  return `${scheduleId}@${localDayKey(day)}`;
}

/**
 * The pomodoro session id for one block occurrence, the same on every device: the phone and the
 * PC starting the same block land on one session (and one exit count).
 */
export function blockSessionId(scheduleId: string, day: Date): string {
  return `block-${scheduleId}-${localDayKey(day)}`;
}

/**
 * The enabled WORK schedule whose window contains `now` (device-local time), if any. Blocks marked
 * "no puedo" for today (`skipped`, blockOccurrenceKey) don't count: no prompt, overlay or blocking.
 */
export function activeWorkSchedule<S extends FocusStatusSchedule>(
  schedules: S[],
  now: Date,
  skipped?: ReadonlySet<string>,
  /** Today's one-off changes (horario 2026-10-19): a moved block runs at its new time. */
  exceptions?: ScheduleExceptionLike[],
): S | null {
  const minute = now.getHours() * 60 + now.getMinutes();
  const today = exceptions?.length ? schedules.map((s) => scheduleOnDate(s, exceptions, now)) : schedules;
  return (
    today.find(
      (s) =>
        s.kind === 'WORK' &&
        s.enabled &&
        s.daysOfWeek.includes(now.getDay()) &&
        minute >= s.startMinute &&
        minute < s.endMinute &&
        !skipped?.has(blockOccurrenceKey(s.id, now)),
    ) ?? null
  );
}

export function currentFocusStatus(input: {
  session: PomodoroSession | null;
  schedules: FocusStatusSchedule[];
  tasks: FocusStatusTask[];
  now?: Date;
  skipped?: ReadonlySet<string>;
  exceptions?: ScheduleExceptionLike[];
}): FocusStatus | null {
  const now = input.now ?? new Date();
  const schedule = activeWorkSchedule(input.schedules, now, input.skipped, input.exceptions);
  const block = schedule ? blockOnDay(schedule, input.tasks, now) : null;
  // A mechanical block ends 60 minutes in, even if its schedule window runs longer.
  const inBlock = block && now < block.endAt ? block : null;
  const label = schedule?.label ?? null;

  const session = input.session;
  // Left the block with "Salir": nothing counts until "Volver al bloque".
  if (session?.active && session.pausedAt) {
    const exits = session.exitCount ?? 1;
    const end = session.blockEndAt ? new Date(session.blockEndAt) : inBlock?.endAt;
    if (end && end > now) {
      // What's left of the pomodoro, frozen at the moment the user left.
      const leftMs = session.startedAt
        ? (getPhaseDurationMinutes(session) ?? 0) * 60_000 - (new Date(session.pausedAt).getTime() - new Date(session.startedAt).getTime())
        : 0;
      const leftSec = Math.max(0, Math.round(leftMs / 1000));
      const left = `faltan ${String(Math.floor(leftSec / 60)).padStart(2, '0')}:${String(leftSec % 60).padStart(2, '0')} del pomodoro`;
      return {
        kind: 'pomodoro',
        title: 'Fuera del bloque · en pausa',
        text: [label, left, `${exits} ${exits === 1 ? 'salida' : 'salidas'}`, 'toca para volver'].filter(Boolean).join(' · '),
        endsAt: end,
        blockLabel: label,
        key: `paused:${session.id ?? ''}:${exits}`,
      };
    }
  }
  if (session?.active && session.startedAt && session.state !== 'IDLE' && !session.pausedAt) {
    const minutes = getPhaseDurationMinutes(session) ?? 0;
    const endsAt = new Date(new Date(session.startedAt).getTime() + minutes * 60_000);
    const profile = session.attentionProfile ? ATTENTION_PROFILE_SPECS[session.attentionProfile].name : null;
    const task = session.taskId ? input.tasks.find((t) => t.id === session.taskId) : null;
    const focus = session.state === 'FOCUS';
    // Sequence mode: the segment's own label ("P2 · profundo: ...") says what this stretch is for.
    const segment = currentSegment(session);
    if (segment) {
      return {
        kind: 'pomodoro',
        title: segment.etiqueta,
        text: [label, task?.title, `tramo ${segment.index + 1} de ${session.sequence!.length}`].filter(Boolean).join(' · '),
        endsAt,
        blockLabel: label,
        key: `pomodoro:${session.id ?? ''}:segment:${segment.index}`,
      };
    }
    const parts = [label, task?.title, `ciclo ${session.completedCycles + (focus ? 1 : 0)}`].filter(Boolean);
    return {
      kind: 'pomodoro',
      title: [PHASES[session.state] ?? 'Pomodoro', profile].filter(Boolean).join(' · '),
      text: parts.join(' · '),
      endsAt,
      blockLabel: label,
      key: `pomodoro:${session.id ?? ''}:${session.state}:${session.completedCycles}`,
    };
  }

  if (schedule && inBlock) {
    const profile = ATTENTION_PROFILE_SPECS[inBlock.profile].name;
    const first = inBlock.tasks[0]?.title;
    return {
      kind: 'schedule',
      title: `Horario de trabajo${label ? ` · ${label}` : ''}`,
      text: [`${hhmm(inBlock.startAt)}-${hhmm(inBlock.endAt)}`, profile, first].filter(Boolean).join(' · '),
      endsAt: inBlock.endAt,
      blockLabel: label,
      key: `schedule:${schedule.id}:${inBlock.startAt.toDateString()}`,
    };
  }
  return null;
}
