import { z } from 'zod';
import {
  TaskDifficultySchema,
  TaskPrioritySchema,
  TaskStatusSchema,
} from './enums.js';

export const TaskSchema = z.object({
  id: z.string().optional(),
  clientId: z.string().max(100).optional().nullable(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
  estimatedMinutes: z.number().int().min(1),
  actualMinutes: z.number().int().min(0).optional().nullable(),
  difficulty: TaskDifficultySchema.default('MEDIUM'),
  complexity: z.number().int().min(1).max(10).default(5),
  priority: TaskPrioritySchema.default('MEDIUM'),
  category: z.string().max(100).optional().nullable(),
  status: TaskStatusSchema.default('PENDING'),
  completedAt: z.string().datetime().optional().nullable(),
});

export const CreateTaskSchema = TaskSchema.omit({ id: true, actualMinutes: true, completedAt: true });
export const UpdateTaskSchema = CreateTaskSchema.partial();

export type Task = z.infer<typeof TaskSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
