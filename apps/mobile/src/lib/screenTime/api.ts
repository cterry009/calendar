import { Platform } from 'react-native';
import ScreenTimeModule from '../../../modules/screen-time/src';
import type { AppUsageRecord } from '../../../modules/screen-time/src';

export type { AppUsageRecord };

// PACKAGE_USAGE_STATS ("Usage access") is Android-only and has no browser equivalent -- every
// export here is guarded the same way lib/stepTracking/api.ts guards its own native-only calls.
export function hasUsageAccess(): boolean {
  if (Platform.OS !== 'android') return false;
  return ScreenTimeModule.hasUsageAccess();
}

export function openUsageAccessSettings(): void {
  if (Platform.OS !== 'android') return;
  ScreenTimeModule.openUsageAccessSettings();
}

export function getAppUsage(startMillis: number, endMillis: number): AppUsageRecord[] {
  if (Platform.OS !== 'android') return [];
  return ScreenTimeModule.getAppUsage(startMillis, endMillis);
}
