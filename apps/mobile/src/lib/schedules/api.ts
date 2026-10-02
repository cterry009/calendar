import { syncBatch, type SyncBatchResponse } from '../sync/api';
import type { SyncScheduleRecord } from '../calendar/types';

// Work and rest schedules on the phone (user-requested, 2026-10-02): create, edit, delete, through
// the same /sync/batch changes the web's ScheduleManager sends. The form only edits label, type,
// days and hours -- pomodoros come from each block's attention profile now -- but an edit carries
// the schedule's old pomodoro fields along, because the server clears any it isn't sent.

export interface ScheduleDraft {
  kind: 'WORK' | 'REST';
  label: string;
  daysOfWeek: number[];
  /** HH:MM */
  start: string;
  end: string;
  enabled: boolean;
}

export const DAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export function hhmm(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

/** "9:05", "09:05" or "905" -> minutes from midnight; null if it isn't a valid time. */
export function parseTime(value: string): number | null {
  const m = /^(\d{1,2}):?(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

export function draftFrom(schedule?: SyncScheduleRecord): ScheduleDraft {
  return schedule
    ? {
        kind: schedule.kind,
        label: schedule.label ?? '',
        daysOfWeek: [...schedule.daysOfWeek].sort(),
        start: hhmm(schedule.startMinute),
        end: hhmm(schedule.endMinute),
        enabled: schedule.enabled,
      }
    : { kind: 'WORK', label: '', daysOfWeek: [1, 2, 3, 4, 5], start: '09:00', end: '10:30', enabled: true };
}

/** The problem with a draft, in Spanish, or null when it can be saved. */
export function draftError(draft: ScheduleDraft): string | null {
  const start = parseTime(draft.start);
  const end = parseTime(draft.end);
  if (start === null || end === null) return 'Escribe las horas como HH:MM, por ejemplo 09:00.';
  if (end <= start) return 'La hora de fin debe ser después de la de inicio.';
  if (draft.daysOfWeek.length === 0) return 'Elige al menos un día.';
  return null;
}

export async function saveSchedule(draft: ScheduleDraft, existing?: SyncScheduleRecord): Promise<SyncBatchResponse> {
  const change = {
    ...(existing ? { id: existing.id } : {}),
    updatedAt: new Date().toISOString(),
    kind: draft.kind,
    daysOfWeek: draft.daysOfWeek,
    startMinute: parseTime(draft.start)!,
    endMinute: parseTime(draft.end)!,
    label: draft.label.trim() || undefined,
    enabled: draft.enabled,
    // Kept as they were: the server would otherwise null them out.
    pomodoroMin: existing?.pomodoroMin ?? undefined,
    shortBreakMin: existing?.shortBreakMin ?? undefined,
    longBreakMin: existing?.longBreakMin ?? undefined,
    pomodorosPerChunk: existing?.pomodorosPerChunk ?? undefined,
    chunks: existing?.chunks ?? undefined,
  };
  return syncBatch({ schedules: [change] });
}

export function deleteSchedule(schedule: SyncScheduleRecord): Promise<SyncBatchResponse> {
  return syncBatch({ schedules: [{ id: schedule.id, updatedAt: new Date().toISOString(), deleted: true }] });
}
