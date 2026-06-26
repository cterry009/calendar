import type { TaskDifficulty, TaskPriority, TaskStatus } from '@calendar/shared';

export interface SyncTaskRecord {
  id: string;
  clientId: string | null;
  title: string;
  description: string | null;
  scheduledAt: string | null;
  estimatedMinutes: number;
  actualMinutes: number | null;
  difficulty: TaskDifficulty;
  complexity: number;
  priority: TaskPriority;
  category: string | null;
  status: TaskStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface TaskFormValues {
  title: string;
  description: string | null;
  scheduledAt: string | null;
  estimatedMinutes: number;
  actualMinutes: number | null;
  difficulty: TaskDifficulty;
  complexity: number;
  priority: TaskPriority;
  category: string | null;
  status: TaskStatus;
}

export type TaskDifficultyFilter = 'ALL' | TaskDifficulty;

export const TASK_DIFFICULTIES: TaskDifficulty[] = ['EASY', 'MEDIUM', 'HARD'];
export const TASK_PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH'];
export const TASK_STATUSES: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
