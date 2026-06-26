import type { PomodoroState } from '@calendar/shared';

export const POMODORO_STATE_LABELS: Record<PomodoroState, string> = {
  IDLE: 'En espera',
  FOCUS: 'Enfoque',
  SHORT_BREAK: 'Descanso corto',
  LONG_BREAK: 'Descanso largo',
};
