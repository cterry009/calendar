import type { PomodoroState } from '@calendar/shared';

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
  createdAt: string;
  updatedAt: string;
}

export interface PomodoroConfigFormValues {
  focusDurationMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  cyclesBeforeLongBreak: number;
}
