import { useEffect } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { drainPendingBlockEvents } from '../lib/focusBlock/api';
import { syncBlockEventBatch } from '../lib/blockEvents/sync';

// Task 8.2. Mounted once at the app root (_layout.tsx), same pattern as FocusBlockingBridge/
// NightBlockingBridge -- drains whatever BlockEvent rows FocusBlockAccessibilityService logged
// natively (possibly while this app process wasn't even running) and hands them to the existing
// sync pipeline. Runs on mount and every time the app returns to the foreground -- there's no
// live push channel from the native side to this hook (the service can't call back into a
// possibly-dead JS engine, same reasoning FocusBlockPrefs.kt's doc comment already gives for the
// opposite direction), so "check when we're actually running" is the only trigger available.
export function useBlockEvents(): void {
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const drain = () => {
      const events = drainPendingBlockEvents();
      if (events.length > 0) {
        void syncBlockEventBatch(events);
      }
    };

    drain();

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') drain();
    });

    return () => subscription.remove();
  }, []);
}
