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
  // FOCUS (pomodoro/work-hours/manual focus -- the "Bloqueo total" list) or NIGHT (an automatic
  // overnight window, task: game-time block suggestions). `useBlockList(scope)` filters to
  // whichever scope its caller asks for (defaults to 'FOCUS', preserving every pre-existing call
  // site's behavior); pass 'ALL' to get both.
  scope: BlockListScope;
  // weekend-mode: a NIGHT entry's own start (null/absent = the night window's).
  nightStartMinutes?: number | null;
  weekendNightStartMinutes?: number | null;
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
  nightStartMinutes?: number | null;
  weekendNightStartMinutes?: number | null;
}

export const BLOCK_LIST_KINDS: BlockListKind[] = ['MOBILE_APP', 'WEBSITE', 'DESKTOP_APP'];

export const BLOCK_LIST_PLATFORMS: DevicePlatform[] = ['WEB', 'ANDROID', 'IOS', 'WINDOWS', 'MACOS'];
