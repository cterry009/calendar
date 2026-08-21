import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { PermissionStatus } from 'expo';
import { Barometer, type BarometerMeasurement } from 'expo-sensors';
import { buildFloorsClimbedPayload, syncFloorsClimbedBatch } from '../lib/floors/api';
import { foldSessionIntoFloorsBaseline, getFloorsBaseline } from '../lib/floors/dailyFloors';

export interface UseDailyFloorsResult {
  isAvailable: boolean | null;
  permissionStatus: PermissionStatus | null;
  floors: number;
  isLoading: boolean;
  requestPermission: () => Promise<void>;
}

// Approximate height of one story, in meters -- same order of magnitude the well-known fitness
// trackers use (Apple/Google both land around 3m / 10ft). Not exact for any given building, but
// good enough to turn "altitude went up by roughly a floor" into a floor count.
const FLOOR_HEIGHT_METERS = 3;
// Sea-level-independent barometric formula (see e.g. the international barometric formula):
// altitude difference in meters between a reference pressure P0 and a current pressure P, both
// in the same units (hPa here). Only relative altitude matters for floor counting, not absolute
// elevation, so no local sea-level-pressure calibration is needed.
function altitudeDeltaMeters(referenceHpa: number, currentHpa: number): number {
  return 44330 * (1 - (currentHpa / referenceHpa) ** (1 / 5.255));
}

// Task 10.8, first real slice: `expo-sensors`' Barometer only exposes `relativeAltitude` on iOS
// (confirmed by reading BarometerModule.kt -- Android's TYPE_PRESSURE sensor only ever reports
// raw pressure, "TODO: can we get relative altitude?" is still unresolved upstream), so Android
// altitude has to be derived here from raw pressure via the barometric formula. Like
// useDailySteps, the barometer only delivers updates in the foreground, so this uses the same
// session-fold-into-daily-baseline architecture rather than pretending to track floors climbed
// around the clock.
export function useDailyFloors(): UseDailyFloorsResult {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus | null>(null);
  const [floors, setFloors] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const baselineRef = useRef(0);
  const sessionFloorsRef = useRef(0);
  // The lowest-pressure (i.e. highest-altitude) point seen since the last floor was counted or
  // the last descent -- climbs are measured from here, not from the session's starting pressure,
  // so descending and re-climbing the same stairwell doesn't silently discount real floors.
  const troughPressureRef = useRef<number | null>(null);

  const endSession = useCallback(() => {
    if (sessionFloorsRef.current <= 0) return;
    const delta = sessionFloorsRef.current;
    sessionFloorsRef.current = 0;
    void foldSessionIntoFloorsBaseline(delta).then((newBaseline) => {
      baselineRef.current = newBaseline;
    });
    void syncFloorsClimbedBatch(buildFloorsClimbedPayload(baselineRef.current + delta)).catch(() => {
      // Best-effort, same as useDailySteps -- the next successful sync carries the total forward.
    });
  }, []);

  const requestPermission = useCallback(async () => {
    const response = await Barometer.requestPermissionsAsync();
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
      const available = await Barometer.isAvailableAsync();
      if (cancelled) return;
      setIsAvailable(available);

      if (!available) {
        setIsLoading(false);
        return;
      }

      const permissions = await Barometer.getPermissionsAsync();
      if (cancelled) return;
      setPermissionStatus(permissions.status);

      const baseline = await getFloorsBaseline();
      if (cancelled) return;
      baselineRef.current = baseline;
      setFloors(baseline);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android' || !isAvailable || permissionStatus !== PermissionStatus.GRANTED) {
      return;
    }

    troughPressureRef.current = null;
    Barometer.setUpdateInterval(1000);

    const subscription = Barometer.addListener(({ pressure }: BarometerMeasurement) => {
      if (troughPressureRef.current === null) {
        troughPressureRef.current = pressure;
        return;
      }

      if (pressure >= troughPressureRef.current) {
        // Higher pressure than the trough means lower (or equal) altitude -- track the new low
        // point instead of counting a climb.
        troughPressureRef.current = pressure;
        return;
      }

      const gain = altitudeDeltaMeters(troughPressureRef.current, pressure);
      const newFloors = Math.floor(gain / FLOOR_HEIGHT_METERS);
      if (newFloors >= 1) {
        sessionFloorsRef.current += newFloors;
        setFloors(baselineRef.current + sessionFloorsRef.current);
        troughPressureRef.current = pressure;
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
    };
  }, [isAvailable, permissionStatus, endSession]);

  return { isAvailable, permissionStatus, floors, isLoading, requestPermission };
}
