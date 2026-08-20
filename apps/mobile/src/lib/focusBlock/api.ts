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
