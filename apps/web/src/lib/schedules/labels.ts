import type { ScheduleKind } from './types';

export const DAY_NAMES_ES = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'] as const;

export const SCHEDULE_KIND_LABELS: Record<ScheduleKind, string> = {
  WORK: 'Trabajo',
  REST: 'Descanso',
};

export const SCHEDULE_STATUS_LABELS = {
  enabled: 'Activo',
  disabled: 'Pausado',
};
