import { registerWebModule, NativeModule } from 'expo';
import type { FocusBlockNativeModule, NativePendingBlockEvent, WebsiteUsageRecord } from './FocusBlock.types';

// A browser can't watch which "app" is in the foreground outside its own tab -- there is no web
// equivalent of an Android AccessibilityService. lib/focusBlock/api.ts guards every call behind
// Platform.OS === 'android' before reaching this module, so these bodies are an honest backstop
// (same pattern as lib/blocklist/installedApps.web.ts), not something callers are expected to hit.
class FocusBlockModule extends NativeModule<{}> implements FocusBlockNativeModule {
  setBlockingState(): void {
    throw new Error('El bloqueo real de apps solo esta disponible en Android.');
  }

  setNightBlockingState(): void {
    throw new Error('El bloqueo real de apps solo esta disponible en Android.');
  }

  setBlockPopupContent(): void {
    // No-op off Android.
  }

  setFocusStatus(): void {
    // No-op off Android: the web app shows its own timer.
  }

  clearFocusStatus(): void {
    // No-op off Android.
  }

  setBlockedDomains(): void {
    // No-op off Android: the desktop blocks sites through the hosts file.
  }

  getWebsiteUsage(): WebsiteUsageRecord[] {
    return [];
  }

  isWorkHours(): boolean {
    return false;
  }

  setWorkSocialLimit(): void {
    // No-op off Android, like the other state pushes.
  }

  setNightWindow(): void {
    throw new Error('El bloqueo real de apps solo esta disponible en Android.');
  }

  getNightWindowStartMinutes(): number {
    return 22 * 60 + 30;
  }

  getNightWindowEndMinutes(): number {
    return 8 * 60;
  }

  isAccessibilityServiceEnabled(): boolean {
    return false;
  }

  openAccessibilitySettings(): void {
    throw new Error('El bloqueo real de apps solo esta disponible en Android.');
  }

  isFullScreenIntentAllowed(): boolean {
    return false;
  }

  openFullScreenIntentSettings(): void {
    throw new Error('El bloqueo real de apps solo esta disponible en Android.');
  }

  isIgnoringBatteryOptimizations(): boolean {
    return false;
  }

  openBatteryOptimizationSettings(): void {
    throw new Error('El bloqueo real de apps solo esta disponible en Android.');
  }

  drainPendingBlockEvents(): NativePendingBlockEvent[] {
    return [];
  }
}

export default registerWebModule(FocusBlockModule, 'FocusBlockModule');
