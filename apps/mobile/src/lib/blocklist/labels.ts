import type { BlockListKind, DevicePlatform } from '@calendar/shared';

// Mirrors apps/web/src/lib/blocklist/labels.ts -- entries are shared across every client (a
// WEBSITE entry created on web still shows up here), so mobile needs the full label set, not
// just the MOBILE_APP/ANDROID ones this screen creates.
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
