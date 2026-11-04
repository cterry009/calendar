import { NativeModule, requireNativeModule } from 'expo';
import type { FocusBlockNativeModule, NativePendingBlockEvent, WebsiteUsageRecord } from './FocusBlock.types';

declare class FocusBlockModule extends NativeModule<{}> implements FocusBlockNativeModule {
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

export default requireNativeModule<FocusBlockModule>('FocusBlock');
