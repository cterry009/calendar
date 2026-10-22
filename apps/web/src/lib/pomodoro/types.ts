import type { AttentionProfile, PomodoroState, SequenceSegment } from '@calendar/shared';

export interface SyncPomodoroRecord {
  id: string;
  taskId: string | null;
  state: PomodoroState;
  focusDurationMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  cyclesBeforeLongBreak: number;
  completedCycles: number;
  active: boolean;
  interrupted: boolean;
  startedAt: string | null;
  endedAt: string | null;
  // Block mode: ends at the WORK block's fixed end (see createBlockPomodoroSession).
  blockEndAt?: string | null;
  attentionProfile?: AttentionProfile | null;
  // The WORK block it belongs to; paused with "Salir" and how many times (2026-10-06).
  scheduleId?: string | null;
  pausedAt?: string | null;
  exitCount?: number;
  /** Focus pomodoros already rated or dismissed on any device (the other closes its card). */
  reviewedCycles?: number;
  /** Sequence mode (horario 2026-10-19): segments anchored to blockStartAt, the running one, cuts. */
  blockStartAt?: string | null;
  sequence?: SequenceSegment[] | null;
  segmentIndex?: number | null;
  cutCount?: number;
  /** Flexible morning block (2026-10-22): relative sequence, window end, check-in length, real focus. */
  flexible?: boolean;
  plannedBlockMin?: number | null;
  windowEndAt?: string | null;
  focusMinutes?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PomodoroConfigFormValues {
  focusDurationMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  cyclesBeforeLongBreak: number;
}
