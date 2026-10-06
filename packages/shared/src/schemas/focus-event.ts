import { z } from 'zod';
import { AttentionProfileSchema } from './enums.js';

// Focus-block telemetry (server FocusEvent). Same contract as BlockEvent: the client-generated id
// is the idempotency key, and an event is immutable once logged.
export const FocusEventKindSchema = z.enum([
  'BLOCK_PROMPT_ACCEPTED',
  'BLOCK_PROMPT_SNOOZED',
  'BLOCK_PROMPT_DECLINED',
  'BLOCK_PROMPT_OPENED',
  'FOCUS_STARTED',
  'FOCUS_COMPLETED',
  'BREAK_COMPLETED',
  'SESSION_CANCELLED',
  'BLOCK_ENDED',
  'CHECK_IN',
  'BLOCK_EXITED',
  'BLOCK_RESUMED',
  'BLOCK_SKIPPED',
]);

export const FocusEventSchema = z.object({
  id: z.string().min(1),
  kind: FocusEventKindSchema,
  occurredAt: z.string().datetime(),
  scheduleId: z.string().optional(),
  taskId: z.string().optional(),
  pomodoroSessionId: z.string().optional(),
  attentionProfile: AttentionProfileSchema.optional(),
  /** When the block was due to start. */
  blockStartAt: z.string().datetime().optional(),
  /** Seconds for durations, minutes for CHECK_IN. */
  value: z.number().int().optional(),
  meta: z.record(z.unknown()).optional(),
});

export type FocusEventKind = z.infer<typeof FocusEventKindSchema>;
export type FocusEvent = z.infer<typeof FocusEventSchema>;
