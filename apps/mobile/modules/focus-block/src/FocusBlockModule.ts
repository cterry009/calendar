import { NativeModule, requireNativeModule } from 'expo';
import type { FocusBlockNativeModule } from './FocusBlock.types';

declare class FocusBlockModule extends NativeModule<{}> implements FocusBlockNativeModule {
  setBlockingState(active: boolean, blockedPackages: string[]): void;
  setNightBlockingState(enabled: boolean, blockedPackages: string[]): void;
  isAccessibilityServiceEnabled(): boolean;
  openAccessibilitySettings(): void;
  isFullScreenIntentAllowed(): boolean;
  openFullScreenIntentSettings(): void;
  isIgnoringBatteryOptimizations(): boolean;
  openBatteryOptimizationSettings(): void;
}

export default requireNativeModule<FocusBlockModule>('FocusBlock');
