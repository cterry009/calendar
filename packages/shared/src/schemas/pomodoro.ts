import { z } from 'zod';
import { PomodoroStateSchema } from './enums.js';

export const PomodoroConfigSchema = z.object({
  focusDurationMin: z.number().int().min(1).default(25),
  shortBreakMin: z.number().int().min(1).default(5),
  longBreakMin: z.number().int().min(1).default(15),
  cyclesBeforeLongBreak: z.number().int().min(1).default(4),
});

export const PomodoroSessionSchema = z.object({
  id: z.string().optional(),
  taskId: z.string().optional().nullable(),
  state: PomodoroStateSchema.default('IDLE'),
  focusDurationMin: z.number().int().min(1).default(25),
  shortBreakMin: z.number().int().min(1).default(5),
  longBreakMin: z.number().int().min(1).default(15),
  cyclesBeforeLongBreak: z.number().int().min(1).default(4),
  completedCycles: z.number().int().min(0).default(0),
  active: z.boolean().default(false),
  interrupted: z.boolean().default(false),
  startedAt: z.string().datetime().optional().nullable(),
  endedAt: z.string().datetime().optional().nullable(),
});

export type PomodoroConfig = z.infer<typeof PomodoroConfigSchema>;
export type PomodoroSession = z.infer<typeof PomodoroSessionSchema>;
