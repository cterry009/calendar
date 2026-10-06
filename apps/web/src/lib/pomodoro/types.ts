import type { AttentionProfile, PomodoroState } from '@calendar/shared';

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
  createdAt: string;
  updatedAt: string;
}

export interface PomodoroConfigFormValues {
  focusDurationMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  cyclesBeforeLongBreak: number;
}
