import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePomodoro } from '../context/PomodoroContext';
import { useSync } from '../context/SyncContext';
import { localDateAt } from '../lib/blockPrompt/block';
import { skippedBlockKeys } from '../lib/calendar/skips';
import type { SyncScheduleCompletion, SyncScheduleRecord } from '../lib/calendar/types';
import { setBlockPopupContent, setBlockedDomains, setBlockingState, setWorkSocialLimit } from '../lib/focusBlock/api';
import {
  activeWorkSchedule,
  activitySuggestionsByCategory,
  flexibleWorkWindows,
  getPhaseDurationMinutes,
  knownDistractingPackages,
  motivationalPhrases,
  normalizeWebsiteDomain,
  type ScheduleExceptionLike,
} from '@calendar/shared';
import { pullSnapshot } from '../lib/sync/api';
import { toExceptionLikes } from '../lib/plan/api';
import { useBlockList } from './useBlockList';
import { useFocusLockdownEnabled } from './useFocusLockdownEnabled';

// Matches apps/web's SoftFocusContext WORK_HOURS_CHECK_INTERVAL_MS -- work-hours boundary
// crossings aren't driven by any data change, so this is the only thing that needs a timer here.
const WORK_HOURS_CHECK_INTERVAL_MS = 30_000;

export interface FocusBlockingState {
  isActive: boolean;
  isPomodoroBlocking: boolean;
  isWorkHoursActive: boolean;
  blockedPackageNames: string[];
  lockdownEnabled: boolean;
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
  const { isBlocking: isPomodoroBlocking, session } = usePomodoro();
  const { entries, refetch: refetchBlockList } = useBlockList();
  const { registerRefetch } = useSync();
  const [lockdownEnabled] = useFocusLockdownEnabled();
  const [schedules, setSchedules] = useState<SyncScheduleRecord[]>([]);
  const [completions, setCompletions] = useState<SyncScheduleCompletion[]>([]);
  const [exceptions, setExceptions] = useState<ScheduleExceptionLike[]>([]);
  const [now, setNow] = useState(() => new Date());

  const refetchSchedules = useCallback(async () => {
    try {
      const snapshot = await pullSnapshot();
      setSchedules(snapshot.schedules);
      setCompletions(snapshot.scheduleCompletions ?? []);
      setExceptions(toExceptionLikes(snapshot.scheduleExceptions));
    } catch {
      // Best-effort: a stale schedule list just means a slightly stale work-hours trigger, not a
      // crash -- the other two inputs (pomodoro, block list) still update independently.
    }
  }, []);

  useEffect(() => {
    void refetchSchedules();
  }, [refetchSchedules]);

  useEffect(() => registerRefetch(refetchSchedules), [registerRefetch, refetchSchedules]);

  // Also re-pulls the block list on the same timer -- real bug found on-device: this hook's own
  // useBlockList() call is a separate instance from the one blocklist.tsx uses (every hook in this
  // app independently pulls, see design.md), and useBlockList's cross-instance sync only fires on
  // an offline-queue flush, never on a plain successful online mutation. Without this, adding an
  // app to the block list while this hook was already mounted (i.e. any time after login) never
  // reached the native side at all -- confirmed via /shared_prefs/focus_block_state.xml showing an
  // empty blocked_packages set despite a real entry existing. Same "eventually consistent, not
  // instant" trade-off as the work-hours check already made here, not a full fix for the general
  // cross-hook staleness gap (that would need a broader SyncContext change, out of scope here).
  useEffect(() => {
    const timerId = setInterval(() => {
      setNow(new Date());
      void refetchBlockList();
    }, WORK_HOURS_CHECK_INTERVAL_MS);
    return () => clearInterval(timerId);
  }, [refetchBlockList]);

  // A block marked "no puedo" today isn't work hours: nothing is blocked during it.
  const skipped = useMemo(() => skippedBlockKeys(completions), [completions]);
  // A block moved for today (horario 2026-10-19) is work hours at its new time.
  const activeWork = activeWorkSchedule(schedules, now, skipped, exceptions);
  const isWorkHoursActive = activeWork !== null;
  // Left this block with "Salir": the list and the total lock lift so the phone can be used for
  // something else; social media and games stay blocked natively (WorkSocialLimit) until it ends.
  const exitedThisBlock = !!session?.pausedAt && !!activeWork && session.scheduleId === activeWork.id;
  const isActive = isPomodoroBlocking || (isWorkHoursActive && !exitedThisBlock);

  // When the blocking should lift if nobody says so again: the later of the focus phase's end and
  // the WORK block's end. Handed to the native side so a reclaimed app process can't leave apps
  // blocked forever (FocusBlockPrefs.isActive).
  const phaseEndMs =
    isPomodoroBlocking && session?.startedAt
      ? new Date(session.startedAt).getTime() + (getPhaseDurationMinutes(session) ?? 0) * 60_000
      : 0;
  const workEndMs = activeWork ? localDateAt(activeWork.endMinute, now).getTime() : 0;
  const activeUntilMs = Math.max(phaseEndMs, workEndMs);

  const blockedPackageNames = useMemo(
    () =>
      entries
        // Task 11.8: scoped to FOCUS explicitly -- NIGHT-scope entries (task 11.9) drive a
        // separate trigger (task 11.10/11.11, evaluated natively) and must never be blocked
        // during the day just because they're enabled here too.
        .filter(
          (entry) =>
            entry.enabled && entry.kind === 'MOBILE_APP' && entry.platform === 'ANDROID' && entry.scope === 'FOCUS',
        )
        .map((entry) => entry.identifier),
    [entries],
  );

  useEffect(() => {
    setBlockingState(isActive, activeUntilMs ? new Date(activeUntilMs) : null, blockedPackageNames, lockdownEnabled);
  }, [isActive, activeUntilMs, blockedPackageNames, lockdownEnabled]);

  // Websites on the block list are kicked in the phone's browsers too (2026-10-06), each list under
  // its own conditions, evaluated natively like the apps.
  const domainsKey = JSON.stringify(
    (['FOCUS', 'NIGHT'] as const).map((scope) =>
      entries
        .filter((entry) => entry.enabled && entry.kind === 'WEBSITE' && entry.scope === scope)
        .map((entry) => normalizeWebsiteDomain(entry.identifier))
        .filter((domain): domain is string => domain !== null)
        .sort(),
    ),
  );
  useEffect(() => {
    const [focus, night] = JSON.parse(domainsKey) as [string[], string[]];
    setBlockedDomains(focus, night);
  }, [domainsKey]);

  // The strict social limit during work hours runs natively (WorkSocialLimit.kt); it only needs the
  // WORK windows and the social list, pushed whenever the schedules change.
  const workWindowsKey = JSON.stringify([
    ...schedules
      // Flexible blocks (2026-10-22) don't block by themselves; their weekday windows below do.
      .filter((schedule) => schedule.enabled && schedule.kind === 'WORK' && !schedule.flexibleBlocks)
      .map((schedule) => ({
        days: schedule.daysOfWeek,
        start: schedule.startMinute,
        end: schedule.endMinute,
        // Shown in the block popup: "estas en tu bloque de trabajo «Estudio B2»".
        label: schedule.label ?? undefined,
        id: schedule.id,
        // Days it was marked "no puedo": not work hours natively either. Nor the days it was moved
        // to another time: the native side only knows weekly windows, so the moved block is
        // blocked from JS (activeWork above) while the app runs, not natively.
        skip: [
          ...[...skipped].filter((key) => key.startsWith(`${schedule.id}@`)).map((key) => key.split('@')[1]),
          ...exceptions
            .filter((e) => e.scheduleId === schedule.id && (e.startMinute != null || e.endMinute != null))
            .map((e) => e.date),
        ],
      })),
    // The weekday work windows (09:00-13:00, 14:00-18:00), block started or not (user, 2026-10-29):
    // the native side kicks games and social media out through them (kickIfInWorkFocus), with the RN
    // process dead too. No id: the "fuera del bloque" bar belongs to a block, not to the window.
    ...flexibleWorkWindows(schedules).map((window) => ({
      days: window.days,
      start: window.startMinute,
      end: window.endMinute,
      label: 'Horario de trabajo',
      skip: [],
    })),
  ]);
  useEffect(() => {
    setWorkSocialLimit(JSON.parse(workWindowsKey), knownDistractingPackages());
  }, [workWindowsKey]);

  useEffect(() => {
    setBlockPopupContent({ suggestions: activitySuggestionsByCategory(), phrases: motivationalPhrases() });
  }, []);

  return { isActive, isPomodoroBlocking, isWorkHoursActive, blockedPackageNames, lockdownEnabled };
}
