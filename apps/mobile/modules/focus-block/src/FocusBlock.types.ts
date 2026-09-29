// Task 8.2. `scope`/`trigger` are the raw strings the Kotlin side writes ("FOCUS"/"NIGHT",
// "BLOCKED_OPEN_ATTEMPT"/"NIGHT_UNLOCK") -- kept as `string` here rather than importing
// @calendar/shared's BlockListScope/BlockEventTrigger unions, since this module (like every
// local Expo module in this app) has no dependency on that package; lib/blockEvents/sync.ts casts
// them at the one point they cross into typed JS code.
export interface NativePendingBlockEvent {
  id: string;
  identifier: string | null;
  scope: string;
  trigger: string;
  occurredAt: string;
}

export interface FocusBlockNativeModule {
  // `lockdown` (task 7.28): when true and `active`, the AccessibilityService blocks every
  // non-allowlisted foreground app, not just the ones in `blockedPackages`.
  setBlockingState(active: boolean, blockedPackages: string[], lockdown: boolean): void;
  setNightBlockingState(enabled: boolean, blockedPackages: string[]): void;
  setNightWindow(startMinutes: number, endMinutes: number): void;
  setWorkSocialLimit(windowsJson: string, socialPackages: string[]): void;
  isWorkHours(): boolean;
  setBlockPopupContent(json: string): void;
  getNightWindowStartMinutes(): number;
  getNightWindowEndMinutes(): number;
  isAccessibilityServiceEnabled(): boolean;
  openAccessibilitySettings(): void;
  isFullScreenIntentAllowed(): boolean;
  openFullScreenIntentSettings(): void;
  isIgnoringBatteryOptimizations(): boolean;
  openBatteryOptimizationSettings(): void;
  drainPendingBlockEvents(): NativePendingBlockEvent[];
}
