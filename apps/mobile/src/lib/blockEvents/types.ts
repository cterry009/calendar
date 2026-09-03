import type { BlockEventTrigger, BlockListScope } from '@calendar/shared';

// Task 8.2. Mirrors the server's BlockEvent row / packages/shared's BlockEventSchema.
export interface SyncBlockEventRecord {
  id: string;
  identifier: string | null;
  scope: BlockListScope;
  trigger: BlockEventTrigger;
  occurredAt: string;
}
