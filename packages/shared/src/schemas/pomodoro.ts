import { z } from 'zod';
import { AttentionProfileSchema, PomodoroStateSchema } from './enums.js';

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
  // Block mode: a session started for a WORK block ends at the block's fixed end, trimming the
  // last phase to it, and records the block's attention profile.
  blockEndAt: z.string().datetime().optional().nullable(),
  attentionProfile: AttentionProfileSchema.optional().nullable(),
  // The WORK block it belongs to (block mode).
  scheduleId: z.string().optional().nullable(),
  // "Salir" (2026-10-06): while paused nothing counts; resuming moves startedAt forward by the
  // paused time. exitCount is how many times the user left the block.
  pausedAt: z.string().datetime().optional().nullable(),
  exitCount: z.number().int().min(0).optional(),
});

export type PomodoroConfig = z.infer<typeof PomodoroConfigSchema>;
export type PomodoroSession = z.infer<typeof PomodoroSessionSchema>;
