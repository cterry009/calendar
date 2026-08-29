import { registerWebModule, NativeModule } from 'expo';
import type { ActivityRecognitionNativeModule } from './ActivityRecognition.types';

// No web equivalent of Play Services' ActivityRecognitionClient -- lib/activityRecognition/api.ts
// guards every call behind Platform.OS === 'android' before reaching this module (same pattern as
// modules/focus-block's web stub).
class ActivityRecognitionModule extends NativeModule<{}> implements ActivityRecognitionNativeModule {
  hasPermission(): boolean {
    return false;
  }

  startTracking(): void {}

  stopTracking(): void {}

  hasJoggedToday(): boolean {
    return false;
  }

  getLastJogDurationMinutes(): number | null {
    return null;
  }
}

export default registerWebModule(ActivityRecognitionModule, 'ActivityRecognitionModule');
