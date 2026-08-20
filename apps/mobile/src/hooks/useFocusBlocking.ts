import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePomodoro } from '../context/PomodoroContext';
import { useSync } from '../context/SyncContext';
import { isNowWithinWorkSchedule } from '../lib/calendar/utils';
import type { SyncScheduleRecord } from '../lib/calendar/types';
import { setBlockingState } from '../lib/focusBlock/api';
import { pullSnapshot } from '../lib/sync/api';
import { useBlockList } from './useBlockList';

// Matches apps/web's SoftFocusContext WORK_HOURS_CHECK_INTERVAL_MS -- work-hours boundary
// crossings aren't driven by any data change, so this is the only thing that needs a timer here.
const WORK_HOURS_CHECK_INTERVAL_MS = 30_000;

export interface FocusBlockingState {
  isActive: boolean;
  isPomodoroBlocking: boolean;
  isWorkHoursActive: boolean;
  blockedPackageNames: string[];
}

/**
 * Task 6.6/6.8's trigger computation: combines the same two independent conditions apps/web's
 * SoftFocusContext does -- a pomodoro focus phase active, or a WORK schedule covering right now.
 * "Task focus" isn't a separate trigger on either platform: it's a pomodoro session with a
 * `taskId` set, already covered by `isPomodoroBlocking` (see design.md decision for 6.6 -- this
 * was confirmed against web's actual code, not assumed). LOCATION/WIFI `FocusTrigger` enforcement
 * (real on web via `navigator.geolocation`, WIFI not enforced there either since browsers can't
 * read SSIDs) is deliberately not ported here -- a real, stated scope cut for a later pass, not a
 * silent gap.
 *
 * Pushes the result to the native AccessibilityService (lib/focusBlock/api.ts, no-ops off-Android)
 * whenever it changes. Mounted once at the app root (_layout.tsx) so it stays live for as long as
 * the RN app process is alive -- see FocusBlockAccessibilityService.kt's doc comment for the real
 * limitation once the app is fully killed (the service can keep running on stale state).
 */
export function useFocusBlocking(): FocusBlockingState {
  const { isBlocking: isPomodoroBlocking } = usePomodoro();
  const { entries } = useBlockList();
  const { registerRefetch } = useSync();
  const [schedules, setSchedules] = useState<SyncScheduleRecord[]>([]);
  const [now, setNow] = useState(() => new Date());

  const refetchSchedules = useCallback(async () => {
    try {
      const snapshot = await pullSnapshot();
      setSchedules(snapshot.schedules);
    } catch {
      // Best-effort: a stale schedule list just means a slightly stale work-hours trigger, not a
      // crash -- the other two inputs (pomodoro, block list) still update independently.
    }
  }, []);

  useEffect(() => {
    void refetchSchedules();
  }, [refetchSchedules]);

  useEffect(() => registerRefetch(refetchSchedules), [registerRefetch, refetchSchedules]);

  useEffect(() => {
    const timerId = setInterval(() => setNow(new Date()), WORK_HOURS_CHECK_INTERVAL_MS);
    return () => clearInterval(timerId);
  }, []);

  const isWorkHoursActive = isNowWithinWorkSchedule(schedules, now);
  const isActive = isPomodoroBlocking || isWorkHoursActive;

  const blockedPackageNames = useMemo(
    () =>
      entries
        .filter((entry) => entry.enabled && entry.kind === 'MOBILE_APP' && entry.platform === 'ANDROID')
        .map((entry) => entry.identifier),
    [entries],
  );

  useEffect(() => {
    setBlockingState(isActive, blockedPackageNames);
  }, [isActive, blockedPackageNames]);

  return { isActive, isPomodoroBlocking, isWorkHoursActive, blockedPackageNames };
}
