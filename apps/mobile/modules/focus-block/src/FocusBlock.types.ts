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

/** Time on one website, measured by the accessibility service from the browser's address bar. */
export interface WebsiteUsageRecord {
  domain: string;
  totalTimeMs: number;
}

export interface FocusBlockNativeModule {
  // `lockdown` (task 7.28): when true and `active`, the AccessibilityService blocks every
  // non-allowlisted foreground app, not just the ones in `blockedPackages`.
  setBlockingState(active: boolean, activeUntilMs: number, blockedPackages: string[], lockdown: boolean): void;
  setNightBlockingState(enabled: boolean, blockedPackages: string[]): void;
  setNightWindow(startMinutes: number, endMinutes: number, weekendStartMinutes: number): void;
  setNightAppStarts(json: string): void;
  setCommitmentUntil(untilMs: number): void;
  isDeviceAdminActive(): boolean;
  requestDeviceAdmin(): void;
  removeDeviceAdmin(): void;
  setWorkSocialLimit(windowsJson: string, socialPackages: string[]): void;
  isWorkHours(): boolean;
  setBlockPopupContent(json: string): void;
  setFocusStatus(title: string, text: string, endsAtMs: number): void;
  clearFocusStatus(): void;
  setBlockedDomains(focus: string[], night: string[]): void;
  setFocusOverlayState(json: string): void;
  drainOverlayExits(): { key: string; at: string }[];
  clearOverlayExit(key: string): void;
  markBlockReviewed(key: string): void;
  getWebsiteUsage(startMillis: number, endMillis: number): WebsiteUsageRecord[];
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
