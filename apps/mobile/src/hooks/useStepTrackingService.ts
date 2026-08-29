import { useEffect } from 'react';
import { Platform } from 'react-native';
import { startStepTracking } from '../lib/stepTracking/api';

// Task 11.16. Starts the native foreground service once per app session -- like
// useJogDetection.ts, only needs arming once; StepTrackingService.kt keeps running (and its
// persistent notification keeps updating) independent of this hook's own lifecycle after that,
// including if the RN JS process is later killed. Deliberately not gated behind Health Connect
// availability: the notification itself is the "still running in the background" signal the
// user asked for, so it starts regardless of which source apps/fitness.tsx's step count display
// ends up preferring.
export function useStepTrackingService(): void {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    startStepTracking();
  }, []);
}
