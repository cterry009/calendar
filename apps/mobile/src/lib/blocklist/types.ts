import type { BlockListKind, DevicePlatform } from '@calendar/shared';

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
}
