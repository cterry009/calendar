import type { PomodoroSession } from '../schemas/pomodoro.js';
import { getPhaseDurationMinutes } from '../pomodoro/state-machine.js';
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

/** The enabled WORK schedule whose window contains `now` (device-local time), if any. */
export function activeWorkSchedule<S extends FocusStatusSchedule>(schedules: S[], now: Date): S | null {
  const minute = now.getHours() * 60 + now.getMinutes();
  return (
    schedules.find(
      (s) => s.kind === 'WORK' && s.enabled && s.daysOfWeek.includes(now.getDay()) && minute >= s.startMinute && minute < s.endMinute,
    ) ?? null
  );
}

export function currentFocusStatus(input: {
  session: PomodoroSession | null;
  schedules: FocusStatusSchedule[];
  tasks: FocusStatusTask[];
  now?: Date;
}): FocusStatus | null {
  const now = input.now ?? new Date();
  const schedule = activeWorkSchedule(input.schedules, now);
  const block = schedule ? blockOnDay(schedule, input.tasks, now) : null;
  // A mechanical block ends 60 minutes in, even if its schedule window runs longer.
  const inBlock = block && now < block.endAt ? block : null;
  const label = schedule?.label ?? null;

  const session = input.session;
  if (session?.active && session.startedAt && session.state !== 'IDLE') {
    const minutes = getPhaseDurationMinutes(session) ?? 0;
    const endsAt = new Date(new Date(session.startedAt).getTime() + minutes * 60_000);
    const profile = session.attentionProfile ? ATTENTION_PROFILE_SPECS[session.attentionProfile].name : null;
    const task = session.taskId ? input.tasks.find((t) => t.id === session.taskId) : null;
    const focus = session.state === 'FOCUS';
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
