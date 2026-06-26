import type { TaskDifficulty, TaskPriority, TaskStatus } from '@calendar/shared';
import type { TaskDifficultyFilter } from './types';

export const TASK_DIFFICULTY_LABELS: Record<TaskDifficulty, string> = {
  EASY: 'Facil',
  MEDIUM: 'Media',
  HARD: 'Dificil',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
};

export const TASK_DIFFICULTY_FILTER_LABELS: Record<TaskDifficultyFilter, string> = {
  ALL: 'Todas',
  EASY: TASK_DIFFICULTY_LABELS.EASY,
  MEDIUM: TASK_DIFFICULTY_LABELS.MEDIUM,
  HARD: TASK_DIFFICULTY_LABELS.HARD,
};
