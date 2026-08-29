import { NativeModule, requireNativeModule } from 'expo';
import type { AppUsageRecord, ScreenTimeNativeModule } from './ScreenTime.types';

declare class ScreenTimeModule extends NativeModule<{}> implements ScreenTimeNativeModule {
  hasUsageAccess(): boolean;
  openUsageAccessSettings(): void;
  getAppUsage(startMillis: number, endMillis: number): AppUsageRecord[];
}

export default requireNativeModule<ScreenTimeModule>('ScreenTime');
