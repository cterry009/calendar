import type { BlockListKind, BlockListScope, DevicePlatform } from '@calendar/shared';

export interface SyncBlockListRecord {
  id: string;
  kind: BlockListKind;
  identifier: string;
  label: string;
  platform: DevicePlatform | null;
  highDopamine: boolean;
  enabled: boolean;
  hardMode: boolean;
  // Task 11.8: FOCUS (pomodoro/work-hours, what every entry web can create/edit is) or NIGHT (the
  // new mobile-only automatic 22:30-08:00 list). useBlockList.ts filters this down to FOCUS-only
  // before returning entries -- there's no web UI for the NIGHT list, so a NIGHT entry created
  // from mobile should stay invisible here rather than showing up unfiltered/uneditable.
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
}

export const BLOCK_LIST_KINDS: BlockListKind[] = ['MOBILE_APP', 'WEBSITE', 'DESKTOP_APP'];

export const BLOCK_LIST_PLATFORMS: DevicePlatform[] = ['WEB', 'ANDROID', 'IOS', 'WINDOWS', 'MACOS'];
