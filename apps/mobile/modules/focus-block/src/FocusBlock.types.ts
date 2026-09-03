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
  setBlockingState(active: boolean, blockedPackages: string[]): void;
  setNightBlockingState(enabled: boolean, blockedPackages: string[]): void;
  setNightWindow(startMinutes: number, endMinutes: number): void;
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
