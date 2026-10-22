import type { SequenceSegment } from '@calendar/shared';

export type ScheduleKind = 'WORK' | 'REST';

export interface SyncScheduleRecord {
  id: string;
  kind: ScheduleKind;
  daysOfWeek: number[];
  startMinute: number;
  endMinute: number;
  label: string | null;
  enabled: boolean;
  pomodoroMin: number | null;
  shortBreakMin: number | null;
  longBreakMin: number | null;
  pomodorosPerChunk: number | null;
  chunks: number | null;
  /** Plan category (horario 2026-10-19); absent on snapshots from older servers. */
  category?: string | null;
  /** The block's pomodoro sequence; wins over pomodoroMin & co. */
  sequence?: SequenceSegment[] | null;
  /** The morning window (2026-10-22): blocks started on demand in it; null for a fixed block. */
  flexibleBlocks?: number | null;
}

export interface ScheduleFormValues {
  kind: ScheduleKind;
  daysOfWeek: number[];
  startMinute: number;
  endMinute: number;
  label: string | null;
  enabled: boolean;
  pomodoroMin: number | null;
  shortBreakMin: number | null;
  longBreakMin: number | null;
  pomodorosPerChunk: number | null;
  chunks: number | null;
  /** Left undefined, the block keeps its category / sequence (the server only writes sent fields). */
  category?: string | null;
  sequence?: SequenceSegment[] | null;
  flexibleBlocks?: number | null;
}

export const SCHEDULE_KINDS: ScheduleKind[] = ['WORK', 'REST'];

export function minuteToTimeValue(totalMinutes: number): string {
  const boundedMinutes = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59));
  const hours = Math.floor(boundedMinutes / 60);
  const minutes = boundedMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function timeValueToMinute(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
}
