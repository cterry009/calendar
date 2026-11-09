import { z } from 'zod';

// projects-and-claude-bridge (2026-11-08): the user's projects and their progress log.

const DateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const ProjectStatusSchema = z.enum(['ACTIVE', 'PAUSED', 'BLOCKED', 'IDEA', 'DONE']);
export const ProjectPrioritySchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);
export const ProjectLogSourceSchema = z.enum(['APP', 'CLAUDE']);

export const ProjectSchema = z.object({
  id: z.string().optional(),
  clientId: z.string().max(100).optional().nullable(),
  title: z.string().min(1).max(200),
  summary: z.string().max(500).optional().nullable(),
  status: ProjectStatusSchema.default('ACTIVE'),
  priority: ProjectPrioritySchema.default('MEDIUM'),
  area: z.string().max(100).optional().nullable(),
  color: z.string().max(20).optional().nullable(),
  /** YYYY-MM-DD, a calendar day like HabitRecord.date. */
  deadline: DateKeySchema.optional().nullable(),
  /** 0-100; null = not estimated ("Avance sin estimar"), never shown as 0 %. */
  progress: z.number().int().min(0).max(100).optional().nullable(),
  nextSteps: z.array(z.string().min(1).max(300)).max(30).default([]),
  blocker: z.string().max(500).optional().nullable(),
});

export const ProjectLogEntrySchema = z.object({
  id: z.string().optional(),
  clientId: z.string().max(100).optional().nullable(),
  projectId: z.string().min(1),
  date: DateKeySchema,
  text: z.string().min(1).max(5000),
  source: ProjectLogSourceSchema.default('APP'),
});

export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
export type ProjectPriority = z.infer<typeof ProjectPrioritySchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type ProjectLogEntry = z.infer<typeof ProjectLogEntrySchema>;
