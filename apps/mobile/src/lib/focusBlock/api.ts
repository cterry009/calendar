import { Platform } from 'react-native';
import FocusBlockModule from '../../../modules/focus-block/src';

// Every export here no-ops (or throws, for the two that don't have a sensible silent fallback) on
// anything but Android -- there is no OS-level "what app is in the foreground" concept on web/iOS
// for this local module to hook into. Callers (useFocusBlocking.ts) still run the trigger
// computation on every platform since it's cheap and platform-agnostic; only the native push is
// gated here, one guard point instead of scattering Platform.OS checks through the hook.

export function setBlockingState(active: boolean, blockedPackages: string[]): void {
  if (Platform.OS !== 'android') return;
  FocusBlockModule.setBlockingState(active, blockedPackages);
}

export function isAccessibilityServiceEnabled(): boolean {
  if (Platform.OS !== 'android') return false;
  return FocusBlockModule.isAccessibilityServiceEnabled();
}

export function openAccessibilitySettings(): void {
  if (Platform.OS !== 'android') {
    throw new Error('El bloqueo real de apps solo esta disponible en Android.');
  }
  FocusBlockModule.openAccessibilitySettings();
}

// Task 6.7 fix's other real dependency (Android 14+ only -- see design.md decision 36/37): without
// this, the AccessibilityService's fullScreenIntent notification silently never shows, the same
// "blocked app disappears but no explanation ever appears" symptom the fix itself was for.
export function isFullScreenIntentAllowed(): boolean {
  if (Platform.OS !== 'android') return false;
  return FocusBlockModule.isFullScreenIntentAllowed();
}

export function openFullScreenIntentSettings(): void {
  if (Platform.OS !== 'android') {
    throw new Error('El bloqueo real de apps solo esta disponible en Android.');
  }
  FocusBlockModule.openFullScreenIntentSettings();
}
