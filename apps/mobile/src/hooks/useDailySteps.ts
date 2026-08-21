import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { buildStepCountPayload, syncStepCountBatch } from '../lib/steps/api';
import { foldSessionIntoBaseline, getStepsBaseline } from '../lib/steps/dailySteps';

export interface UseDailyStepsResult {
  isAvailable: boolean | null;
  permissionStatus: Pedometer.PermissionStatus | null;
  steps: number;
  isLoading: boolean;
  requestPermission: () => Promise<void>;
}

// Task 10.6, first real slice. Android's step sensor only delivers live updates while the app is
// in the foreground (Pedometer.watchStepCount -- see dailySteps.ts for why `getStepCountAsync`,
// the historical-range API, isn't used here: it's iOS-only, Android throws
// "not supported... yet" for it). So this counts steps taken during each foreground session and
// folds them into a persisted daily baseline whenever a session ends (backgrounded or unmounted),
// rather than pretending to track steps around the clock. A true always-on Android counter needs
// Health Connect (a real, separate integration, not a tweak of this one -- see task 10.6's note).
export function useDailySteps(): UseDailyStepsResult {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Pedometer.PermissionStatus | null>(null);
  const [steps, setSteps] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Refs, not state: the pedometer callback and the AppState listener both need the latest
  // baseline/session-delta synchronously, without re-subscribing every render.
  const baselineRef = useRef(0);
  const sessionDeltaRef = useRef(0);

  const endSession = useCallback(() => {
    if (sessionDeltaRef.current <= 0) return;
    const delta = sessionDeltaRef.current;
    sessionDeltaRef.current = 0;
    void foldSessionIntoBaseline(delta).then((newBaseline) => {
      baselineRef.current = newBaseline;
    });
    void syncStepCountBatch(buildStepCountPayload(baselineRef.current + delta)).catch(() => {
      // Best-effort -- the next successful sync (any pullSnapshot/syncBatch call, or the next
      // time this hook mounts) carries the same running total forward, nothing to retry here.
    });
  }, []);

  const requestPermission = useCallback(async () => {
    const response = await Pedometer.requestPermissionsAsync();
    setPermissionStatus(response.status);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      setIsAvailable(false);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      const available = await Pedometer.isAvailableAsync();
      if (cancelled) return;
      setIsAvailable(available);

      if (!available) {
        setIsLoading(false);
        return;
      }

      const permissions = await Pedometer.getPermissionsAsync();
      if (cancelled) return;
      setPermissionStatus(permissions.status);

      const baseline = await getStepsBaseline();
      if (cancelled) return;
      baselineRef.current = baseline;
      setSteps(baseline);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android' || !isAvailable || permissionStatus !== Pedometer.PermissionStatus.GRANTED) {
      return;
    }

    const subscription = Pedometer.watchStepCount((result) => {
      sessionDeltaRef.current = result.steps;
      setSteps(baselineRef.current + result.steps);
    });

    const appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState !== 'active') {
        endSession();
      }
    });

    return () => {
      subscription.remove();
      appStateSubscription.remove();
      endSession();
    };
  }, [isAvailable, permissionStatus, endSession]);

  return { isAvailable, permissionStatus, steps, isLoading, requestPermission };
}
