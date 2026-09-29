import type { CalendarEvent } from '../../lib/calendar/types';
import type { FocusPlanSegment } from '../../lib/pomodoro/planner';

export const EVENT_TYPE_LABEL: Record<CalendarEvent['type'], string> = {
  task: 'Tarea',
  work: 'Trabajo',
  rest: 'Descanso',
  pomodoro: 'Pomodoro',
  fitness: 'Fitness',
  habit: 'Habito',
};

export const EVENT_TYPE_COLOR: Record<CalendarEvent['type'], string> = {
  task: '$accent',
  work: '$success',
  rest: '$warning',
  pomodoro: '$muted',
  // Real theme tokens or hex only: '$info' / '$primary' don't exist in the Tamagui theme
  // (packages/ui tokens.ts), and an unresolved token rendered as a broken color.
  fitness: '#4ecde0',
  // Fallback only -- habit bars use each habit's own color (meta.habitColor).
  habit: '$accent',
};

export const SEGMENT_LABEL: Record<FocusPlanSegment['type'], string> = {
  pomodoro: 'Pomodoro',
  'short-break': 'Descanso corto',
  'long-break': 'Descanso largo',
  excluded: 'Almuerzo',
};

export const SEGMENT_COLOR: Record<FocusPlanSegment['type'], string> = {
  pomodoro: '$success',
  'short-break': '$muted',
  'long-break': '$warning',
  excluded: '$error',
};
