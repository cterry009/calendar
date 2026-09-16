import { useEffect } from 'react';
import { Platform } from 'react-native';
import {
  hasActivityRecognitionPermission,
  requestActivityRecognitionPermission,
} from '../lib/activityRecognition/api';
import { startStepTracking } from '../lib/stepTracking/api';

// Task 11.16. Starts the native foreground service once per app session -- like
// useJogDetection.ts, only needs arming once; StepTrackingService.kt keeps running (and its
// persistent notification keeps updating) independent of this hook's own lifecycle after that,
// including if the RN JS process is later killed. Deliberately not gated behind Health Connect
// availability: the notification itself is the "still running in the background" signal the
// user asked for, so it starts regardless of which source apps/fitness.tsx's step count display
// ends up preferring.
//
// Real bug found and fixed: this used to call startStepTracking() unconditionally, with no
// permission check of its own. StepTrackingService.kt's foreground service is manifest-declared
// as FOREGROUND_SERVICE_TYPE_HEALTH, and starting one on Android 14+ without ACTIVITY_RECOGNITION
// already granted throws an uncaught SecurityException that crashes the whole app -- on a fresh
// install (permission not granted yet), this fired before the user ever saw a UI, every single
// launch. Fixed by checking/requesting the permission first, same pattern useJogDetection.ts
// already uses for the same permission (so a user who already granted it there, or here, won't
// see a second system dialog).
export function useStepTrackingService(): void {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let cancelled = false;

    void (async () => {
      const granted = (await hasActivityRecognitionPermission()) || (await requestActivityRecognitionPermission());
      if (cancelled || !granted) return;
      startStepTracking();
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
