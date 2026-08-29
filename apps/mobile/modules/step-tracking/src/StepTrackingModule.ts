import { NativeModule, requireNativeModule } from 'expo';
import type { StepTrackingNativeModule } from './StepTracking.types';

declare class StepTrackingModule extends NativeModule<{}> implements StepTrackingNativeModule {
  startTracking(): void;
  stopTracking(): void;
  setDailyGoal(goal: number): void;
  getDailyGoal(): number;
  getDailySteps(): number;
  isStepSensorAvailable(): boolean;
}

export default requireNativeModule<StepTrackingModule>('StepTracking');
