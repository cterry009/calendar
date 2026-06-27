import type { BlockListKind, DevicePlatform } from '@calendar/shared';

export interface SyncBlockListRecord {
  id: string;
  kind: BlockListKind;
  identifier: string;
  label: string;
  platform: DevicePlatform | null;
  highDopamine: boolean;
  enabled: boolean;
  updatedAt: string;
}

export interface BlockListFormValues {
  kind: BlockListKind;
  identifier: string;
  label: string;
  platform: DevicePlatform | null;
  highDopamine: boolean;
  enabled: boolean;
}

export const BLOCK_LIST_KINDS: BlockListKind[] = ['MOBILE_APP', 'WEBSITE', 'DESKTOP_APP'];

export const BLOCK_LIST_PLATFORMS: DevicePlatform[] = ['WEB', 'ANDROID', 'IOS', 'WINDOWS', 'MACOS'];
