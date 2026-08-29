import type { BlockListKind, BlockListScope, DevicePlatform } from '@calendar/shared';

// Mirrors apps/web/src/lib/blocklist/types.ts.
export interface SyncBlockListRecord {
  id: string;
  kind: BlockListKind;
  identifier: string;
  label: string;
  platform: DevicePlatform | null;
  highDopamine: boolean;
  enabled: boolean;
  hardMode: boolean;
  // Task 11.8: FOCUS (pomodoro/work-hours, the existing list) or NIGHT (task 11.9's automatic
  // 22:30-08:00 list) -- unlike web, mobile *does* build a UI for both scopes (task 11.9), so this
  // isn't filtered away at the hook level the way web's useBlockList.ts does; each consumer that
  // cares about only one scope (useFocusBlocking.ts's daytime trigger, the night-list screen)
  // filters for itself.
  scope: BlockListScope;
  updatedAt: string;
}

export interface BlockListFormValues {
  kind: BlockListKind;
  identifier: string;
  label: string;
  platform: DevicePlatform | null;
  highDopamine: boolean;
  enabled: boolean;
  hardMode: boolean;
  scope: BlockListScope;
}
