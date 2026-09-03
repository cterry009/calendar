import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useScreenTime } from './useScreenTime';
import { syncDailyScreenTime } from '../lib/screenTime/sync';

// Task 8.3. Mounted once at the app root (_layout.tsx) as ScreenTimeSyncBridge, same pattern as
// every other bridge there. Reuses useScreenTime.ts's own todayUsage/refresh (the screen-time
// screen's data source) rather than a second native read -- pushes a fresh snapshot whenever it
// changes, and re-reads on every foreground transition so a session spent in other apps shows up
// the next time this one is opened. Screen time doesn't need push-worthy freshness (it's a
// dashboard trend, not a live counter), so "whenever this app is actually running" is enough,
// same cadence useBlockEvents.ts already uses for the same reason.
export function useScreenTimeSync(): void {
  const { isSupported, hasAccess, todayUsage, refresh } = useScreenTime();
  const lastPushedRef = useRef<string>('');

  useEffect(() => {
    if (!isSupported || !hasAccess) return;

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') refresh();
    });

    return () => subscription.remove();
  }, [isSupported, hasAccess, refresh]);

  useEffect(() => {
    if (!isSupported || !hasAccess || todayUsage.length === 0) return;

    // Cheap dedupe against pushing the exact same snapshot twice in a row (e.g. two effect runs
    // from an unrelated re-render) -- not a correctness requirement (the server upsert is
    // idempotent either way), just avoids a pointless request.
    const key = todayUsage.map((entry) => `${entry.packageName}:${entry.totalTimeMs}`).join('|');
    if (key === lastPushedRef.current) return;
    lastPushedRef.current = key;

    void syncDailyScreenTime(todayUsage);
  }, [isSupported, hasAccess, todayUsage]);
}
