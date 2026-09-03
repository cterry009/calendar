// Task 8.3. Mirrors the server's DailyScreenTime row / packages/shared's DailyScreenTimeSchema.
export interface SyncTopAppUsage {
  packageName: string;
  minutes: number;
}

export interface SyncDailyScreenTimeRecord {
  id: string;
  date: string;
  totalMinutes: number;
  topApps: SyncTopAppUsage[];
}
