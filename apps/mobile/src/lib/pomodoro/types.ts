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
  createdAt: string;
  updatedAt: string;
}

export interface PomodoroConfigFormValues {
  focusDurationMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  cyclesBeforeLongBreak: number;
}
