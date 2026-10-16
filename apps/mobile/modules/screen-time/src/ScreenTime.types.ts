export interface AppUsageRecord {
  packageName: string;
  totalTimeMs: number;
  /** The app's name (falls back to the package name); absent on builds before 2026-10-15. */
  label?: string;
  /** Android files it as a game (category or FLAG_IS_GAME). */
  isGame?: boolean;
}

export interface ScreenTimeNativeModule {
  hasUsageAccess(): boolean;
  openUsageAccessSettings(): void;
  getAppUsage(startMillis: number, endMillis: number): AppUsageRecord[];
}
