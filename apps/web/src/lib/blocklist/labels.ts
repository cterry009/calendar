import type { BlockListKind, DevicePlatform } from '@calendar/shared';

export const BLOCK_LIST_KIND_LABELS: Record<BlockListKind, string> = {
  MOBILE_APP: 'App movil',
  WEBSITE: 'Sitio web',
  DESKTOP_APP: 'App de escritorio',
};

export const BLOCK_LIST_PLATFORM_LABELS: Record<DevicePlatform, string> = {
  WEB: 'Web',
  ANDROID: 'Android',
  IOS: 'iOS',
  WINDOWS: 'Windows',
  MACOS: 'macOS',
};
