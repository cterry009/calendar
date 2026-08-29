import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { buildStepCountPayload, syncStepCountBatch } from '../lib/steps/api';
import { clampSessionSteps, foldSessionIntoBaseline, getStepsBaseline } from '../lib/steps/dailySteps';
import { isHealthConnectAvailable, readDailySteps, requestStepsPermission } from '../lib/healthConnect/api';

// Task 11.1: hold a raw pedometer event for this long before it's reflected in `steps`/folded into
// the session delta, resetting on every new event -- an isolated single-step blip (a vibration,
// picking the phone up) never repeats within the window and gets committed on its own after the
// wait, same as it would have without debouncing; a real walking session keeps producing events
// that keep pushing the commit back. MAX_WAIT_MS caps how long a *continuous* walk can be held back
// so the visible count still advances every few seconds instead of only once activity stops.
const DEBOUNCE_MS = 2_500;
const MAX_WAIT_MS = 3_000;

// Task 11.3: there's no push/subscribe API for a Health Connect aggregate, only a pull -- this is
// how often it's re-read while the app is foregrounded. 60s is frequent enough to feel "live"
// without hammering the Health Connect provider process on every render.
const HEALTH_CONNECT_POLL_MS = 60_000;

function todayDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// 'pending' until the one-time Health Connect probe below resolves; the pedometer effects stay
// gated off until it lands on 'pedometer', so the two branches never race each other.
type StepsSource = 'pending' | 'health-connect' | 'pedometer';

export interface UseDailyStepsResult {
  isAvailable: boolean | null;
  permissionStatus: Pedometer.PermissionStatus | null;
  steps: number;
  isLoading: boolean;
  requestPermission: () => Promise<void>;
  // Exposed so the UI can give an honest answer to "does this count while the app is closed" --
  // fitness.tsx's copy was stale/wrong on this exact point until this field existed (found while
  // updating the tutorial to cover task 11.3, not caught when 11.3 itself shipped).
  source: StepsSource;
}

// Task 10.6's first real slice covered the foreground-only Pedometer path (still here as the
// fallback branch, sensitivity-tuned by task 11.1). Task 11.3 adds a real always-on background
// counter: Health Connect reads the total the phone's own hardware sensor hub already accumulates
// regardless of whether this app is running, tried first, with the Pedometer path only used when
// Health Connect isn't available/granted (see lib/healthConnect/api.ts for why Health Connect was
// chosen over a custom foreground service).
export function useDailySteps(): UseDailyStepsResult {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Pedometer.PermissionStatus | null>(null);
  const [steps, setSteps] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [source, setSource] = useState<StepsSource>('pending');

  // Refs, not state: the pedometer callback and the AppState listener both need the latest
  // baseline/session-delta synchronously, without re-subscribing every render.
  const baselineRef = useRef(0);
  const sessionDeltaRef = useRef(0);

  // Task 11.1 debounce/clamp state -- see the constants above for the reasoning.
  const sessionStartRef = useRef(0);
  const pendingStepsRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingTimers = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (maxWaitTimerRef.current) {
      clearTimeout(maxWaitTimerRef.current);
      maxWaitTimerRef.current = null;
    }
  }, []);

  // Commits whatever the latest debounced/clamped session delta is into visible state. Safe to
  // call with nothing pending (e.g. from endSession on a session that never produced an event).
  const commitPending = useCallback(() => {
    clearPendingTimers();
    sessionDeltaRef.current = pendingStepsRef.current;
    setSteps(baselineRef.current + pendingStepsRef.current);
  }, [clearPendingTimers]);

  const endSession = useCallback(() => {
    commitPending();
    if (sessionDeltaRef.current <= 0) return;
    const delta = sessionDeltaRef.current;
    sessionDeltaRef.current = 0;
    pendingStepsRef.current = 0;
    void foldSessionIntoBaseline(delta).then((newBaseline) => {
      baselineRef.current = newBaseline;
    });
    void syncStepCountBatch(buildStepCountPayload(baselineRef.current + delta)).catch(() => {
      // Best-effort -- the next successful sync (any pullSnapshot/syncBatch call, or the next
      // time this hook mounts) carries the same running total forward, nothing to retry here.
    });
  }, [commitPending]);

  const requestPermission = useCallback(async () => {
    if (source === 'health-connect') {
      const granted = await requestStepsPermission();
      setPermissionStatus(granted ? Pedometer.PermissionStatus.GRANTED : Pedometer.PermissionStatus.DENIED);
      return;
    }
    const response = await Pedometer.requestPermissionsAsync();
    setPermissionStatus(response.status);
  }, [source]);

  // Decide once per app session whether a real always-on background counter is usable before
  // falling back to the foreground-only Pedometer path.
  useEffect(() => {
    if (Platform.OS !== 'android') {
      setIsAvailable(false);
      setIsLoading(false);
      setSource('pedometer'); // harmless: every pedometer effect below also no-ops off Android
      return;
    }

    let cancelled = false;

    void (async () => {
      const hcAvailable = await isHealthConnectAvailable();
      if (cancelled) return;

      if (!hcAvailable) {
        setSource('pedometer');
        return;
      }

      const granted = await requestStepsPermission();
      if (cancelled) return;

      if (!granted) {
        // Health Connect exists but Steps access wasn't granted -- fall back to the device's own
        // foreground pedometer rather than showing nothing at all.
        setSource('pedometer');
        return;
      }

      setIsAvailable(true);
      setPermissionStatus(Pedometer.PermissionStatus.GRANTED);
      setSource('health-connect');
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Health Connect branch: pull the real always-on total. No foreground-session reconstruction
  // needed here -- the OS has already been counting regardless of whether this app was open.
  useEffect(() => {
    if (source !== 'health-connect') return;

    let cancelled = false;

    const poll = async () => {
      const total = await readDailySteps(todayDayKey());
      if (cancelled) return;
      setSteps(total);
      setIsLoading(false);
      void syncStepCountBatch(buildStepCountPayload(total)).catch(() => {
        // Best-effort, same tolerance as the pedometer branch -- the next poll/sync carries the
        // same running total forward.
      });
    };

    void poll();
    const intervalId = setInterval(() => void poll(), HEALTH_CONNECT_POLL_MS);
    const appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') void poll();
    });

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      appStateSubscription.remove();
    };
  }, [source]);

  // Pedometer fallback branch (task 10.6, sensitivity-tuned by task 11.1) -- only runs once the
  // source probe above has landed on 'pedometer'.
  useEffect(() => {
    if (Platform.OS !== 'android' || source !== 'pedometer') return;

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
  }, [source]);

  useEffect(() => {
    if (
      Platform.OS !== 'android' ||
      source !== 'pedometer' ||
      !isAvailable ||
      permissionStatus !== Pedometer.PermissionStatus.GRANTED
    ) {
      return;
    }

    sessionStartRef.current = Date.now();
    pendingStepsRef.current = 0;

    const subscription = Pedometer.watchStepCount((result) => {
      // result.steps is cumulative since this watchStepCount() subscription started (see the
      // module-level doc comment), so clamping against total elapsed session time -- not the gap
      // since the previous event -- is the correct denominator here.
      const elapsedMs = Date.now() - sessionStartRef.current;
      pendingStepsRef.current = clampSessionSteps(result.steps, elapsedMs);

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(commitPending, DEBOUNCE_MS);
      if (!maxWaitTimerRef.current) {
        maxWaitTimerRef.current = setTimeout(commitPending, MAX_WAIT_MS);
      }
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
      clearPendingTimers();
    };
  }, [source, isAvailable, permissionStatus, endSession, commitPending, clearPendingTimers]);

  return { isAvailable, permissionStatus, steps, isLoading, requestPermission, source };
}
