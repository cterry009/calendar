import { registerWebModule, NativeModule } from 'expo';
import type { StepTrackingNativeModule } from './StepTracking.types';

// No web equivalent of an Android foreground service -- lib/stepTracking/api.ts guards every
// call behind Platform.OS === 'android' before reaching this module (same pattern as
// modules/focus-block and modules/activity-recognition's web stubs).
class StepTrackingModule extends NativeModule<{}> implements StepTrackingNativeModule {
  startTracking(): void {}

  stopTracking(): void {}

  setDailyGoal(): void {}

  getDailyGoal(): number {
    return 8000;
  }

  getDailySteps(): number {
    return 0;
  }

  isStepSensorAvailable(): boolean {
    return false;
  }
}

export default registerWebModule(StepTrackingModule, 'StepTrackingModule');
