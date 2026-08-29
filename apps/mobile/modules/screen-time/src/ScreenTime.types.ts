export interface AppUsageRecord {
  packageName: string;
  totalTimeMs: number;
}

export interface ScreenTimeNativeModule {
  hasUsageAccess(): boolean;
  openUsageAccessSettings(): void;
  getAppUsage(startMillis: number, endMillis: number): AppUsageRecord[];
}
