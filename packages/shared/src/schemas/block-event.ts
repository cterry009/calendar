import { z } from 'zod';
import { BlockEventTriggerSchema, BlockListScopeSchema } from './enums.js';

// Task 8.2. `id` is required (not optional like every other schema in this directory) --
// client-generated on the native side so the same event survives an offline-queue retry without
// creating a duplicate row (see server/src/sync/sync.service.ts's applyBlockEventChange). No
// update/partial variant: a block event is immutable once logged, there's nothing to "create vs.
// update" the way a task or block-list entry has.
export const BlockEventSchema = z.object({
  id: z.string().min(1),
  identifier: z.string().min(1).max(255).optional(),
  scope: BlockListScopeSchema,
  trigger: BlockEventTriggerSchema,
  occurredAt: z.string().datetime(),
});

export type BlockEvent = z.infer<typeof BlockEventSchema>;
