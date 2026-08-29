import { NativeModule, requireNativeModule } from 'expo';
import type { ActivityRecognitionNativeModule } from './ActivityRecognition.types';

declare class ActivityRecognitionModule extends NativeModule<{}> implements ActivityRecognitionNativeModule {
  hasPermission(): boolean;
  startTracking(): void;
  stopTracking(): void;
  hasJoggedToday(): boolean;
  getLastJogDurationMinutes(): number | null;
}

export default requireNativeModule<ActivityRecognitionModule>('ActivityRecognition');
