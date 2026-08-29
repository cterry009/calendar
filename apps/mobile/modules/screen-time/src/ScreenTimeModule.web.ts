import { registerWebModule, NativeModule } from 'expo';
import type { AppUsageRecord, ScreenTimeNativeModule } from './ScreenTime.types';

// No browser API exposes per-app usage time -- honest "not supported" stub, same pattern as every
// other native-only module in this app (installed-apps, focus-block, step-tracking). Callers guard
// with Platform.OS === 'android' before reaching this at all.
class ScreenTimeModule extends NativeModule<{}> implements ScreenTimeNativeModule {
  hasUsageAccess(): boolean {
    return false;
  }

  openUsageAccessSettings(): void {}

  getAppUsage(): AppUsageRecord[] {
    return [];
  }
}

export default registerWebModule(ScreenTimeModule, 'ScreenTimeModule');
