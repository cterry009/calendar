import { useEffect } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import {
  hasActivityRecognitionPermission,
  requestActivityRecognitionPermission,
  startJogDetection,
} from '../lib/activityRecognition/api';
import { maybeAutoLogJog } from '../lib/activityRecognition/autoLog';

// Task 11.2. Unlike useDailySteps.ts's Pedometer subscription, this only needs to be armed once
// per app session (not re-subscribed on every foreground) -- ActivityTransitionReceiver.kt keeps
// receiving transitions independent of the RN JS process once registered. Mounted once at the app
// root, same as useFocusBlocking (see _layout.tsx).
export function useJogDetection(): void {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let cancelled = false;

    void (async () => {
      const granted = (await hasActivityRecognitionPermission()) || (await requestActivityRecognitionPermission());
      if (cancelled || !granted) return;
      startJogDetection();
      void maybeAutoLogJog();
    })();

    // Opportunistic, not scheduled -- same "check when the app happens to be open" tolerance
    // suggestionNotifications.ts already accepts, since there's no background-task infra to fire
    // this the instant a run finishes while the app is closed.
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void maybeAutoLogJog();
      }
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);
}
