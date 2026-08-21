export interface FocusBlockNativeModule {
  setBlockingState(active: boolean, blockedPackages: string[]): void;
  isAccessibilityServiceEnabled(): boolean;
  openAccessibilitySettings(): void;
  isFullScreenIntentAllowed(): boolean;
  openFullScreenIntentSettings(): void;
}
