import type { CalendarEvent } from '../../lib/calendar/types';
import type { FocusPlanSegment } from '../../lib/pomodoro/planner';

export const EVENT_TYPE_LABEL: Record<CalendarEvent['type'], string> = {
  task: 'Tarea',
  work: 'Trabajo',
  rest: 'Descanso',
  pomodoro: 'Pomodoro',
  fitness: 'Fitness',
};

export const EVENT_TYPE_COLOR: Record<CalendarEvent['type'], string> = {
  task: '$accent',
  work: '$success',
  rest: '$warning',
  pomodoro: '$muted',
  fitness: '$info',
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
