import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  activeWorkSchedule,
  blockOnDay,
  blockSessionId,
  currentStudySession,
  isWithinRadius,
  MIN_TRIMMED_FOCUS_MIN,
} from '@calendar/shared';
import { useFocusTriggers } from '../hooks/useFocusTriggers';
import { useSchedules } from '../hooks/useSchedules';
import { useSkippedBlocks } from '../hooks/useSkippedBlocks';
import { useTasks } from '../hooks/useTasks';
import { usePomodoro } from './PomodoroContext';

interface ManualSoftFocusState {
  active: boolean;
  endsAt: string | null;
  durationMin: number;
}

interface SoftFocusContextValue {
  manualSoftFocus: ManualSoftFocusState;
  manualRemainingSeconds: number;
  /** The full-screen focus overlay (SoftFocusOverlay): a plain pomodoro, manual or location focus. */
  isOverlayVisible: boolean;
  /**
   * Whether the FOCUS block list is enforced: any focus, or a WORK block the user hasn't left with
   * "Salir" (after leaving, social media and games stay blocked through isWithinWorkSchedule).
   */
  isFocusActive: boolean;
  isWorkHoursActive: boolean;
  // Raw "inside an enabled WORK block right now", ignoring the overlay dismissal above. For rules
  // that must stay strict even when the soft overlay was waved away (the work-hours game limit).
  isWithinWorkSchedule: boolean;
  isLocationActive: boolean;
  activeLocationTriggerLabel: string | null;
  startManualFocus: (minutes: number) => void;
  stopManualFocus: () => void;
  dismissWorkHoursFocus: () => void;
  dismissLocationFocus: () => void;
}

const SoftFocusContext = createContext<SoftFocusContextValue | null>(null);

const DEFAULT_DURATION_MIN = 25;
const WORK_HOURS_CHECK_INTERVAL_MS = 30_000;

function getRemainingSeconds(state: ManualSoftFocusState, nowMs: number): number {
  if (!state.active || !state.endsAt) {
    return 0;
  }

  const endsAtMs = new Date(state.endsAt).getTime();
  if (Number.isNaN(endsAtMs)) {
    return 0;
  }

  return Math.max(0, Math.floor((endsAtMs - nowMs) / 1000));
}

export function SoftFocusProvider({ children }: { children: ReactNode }) {
  const pomodoro = usePomodoro();
  const { schedules } = useSchedules();
  const { tasks } = useTasks();
  // Blocks marked "no puedo hacer este bloque" today: not work hours at all.
  const skipped = useSkippedBlocks();
  const { enabledTriggers } = useFocusTriggers();
  const [manualSoftFocus, setManualSoftFocus] = useState<ManualSoftFocusState>({
    active: false,
    endsAt: null,
    durationMin: DEFAULT_DURATION_MIN,
  });
  const [now, setNow] = useState(() => Date.now());
  const [workHoursDismissed, setWorkHoursDismissed] = useState(false);
  const [locationDismissed, setLocationDismissed] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<{ latitude: number; longitude: number } | null>(null);

  const startManualFocus = useCallback((minutes: number) => {
    const durationMin = Math.max(1, Math.floor(minutes));
    const endsAt = new Date(Date.now() + durationMin * 60 * 1000).toISOString();
    setManualSoftFocus({
      active: true,
      endsAt,
      durationMin,
    });
    setNow(Date.now());
  }, []);

  const stopManualFocus = useCallback(() => {
    setManualSoftFocus((previous) => ({
      active: false,
      endsAt: null,
      durationMin: previous.durationMin || DEFAULT_DURATION_MIN,
    }));
    setNow(Date.now());
  }, []);

  const dismissWorkHoursFocus = useCallback(() => {
    setWorkHoursDismissed(true);
  }, []);

  const dismissLocationFocus = useCallback(() => {
    setLocationDismissed(true);
  }, []);

  const locationTriggers = useMemo(
    () =>
      enabledTriggers.filter(
        (trigger) =>
          trigger.kind === 'LOCATION' &&
          trigger.latitude != null &&
          trigger.longitude != null &&
          trigger.radiusMeters != null,
      ),
    [enabledTriggers],
  );

  // Real, best-effort enforcement (not just a stored label): watches the browser's reported
  // position while any LOCATION trigger is configured, foreground-only, no background geofencing.
  useEffect(() => {
    if (!locationTriggers.length || typeof navigator === 'undefined' || !navigator.geolocation) {
      setCurrentPosition(null);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentPosition({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      },
      () => {
        setCurrentPosition(null);
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 20_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [locationTriggers.length]);

  useEffect(() => {
    if (!manualSoftFocus.active) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [manualSoftFocus.active]);

  // Always-on tick (independent of manual focus) so scheduled work-hours blocking activates on time.
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, WORK_HOURS_CHECK_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  const manualRemainingSeconds = useMemo(
    () => getRemainingSeconds(manualSoftFocus, now),
    [manualSoftFocus, now],
  );

  useEffect(() => {
    if (!manualSoftFocus.active) {
      return;
    }

    if (manualRemainingSeconds <= 0) {
      stopManualFocus();
    }
  }, [manualRemainingSeconds, manualSoftFocus.active, stopManualFocus]);

  const activeSchedule = useMemo(() => activeWorkSchedule(schedules, new Date(now), skipped), [schedules, now, skipped]);
  const rawIsWorkHoursActive = activeSchedule !== null;

  // A dismissal only lasts for the remainder of the current work block: once we're no longer
  // inside any enabled WORK schedule, the flag resets so the next block triggers normally.
  useEffect(() => {
    if (!rawIsWorkHoursActive && workHoursDismissed) {
      setWorkHoursDismissed(false);
    }
  }, [rawIsWorkHoursActive, workHoursDismissed]);

  // Every WORK block runs its pomodoro (2026-10-06): when a block is on and nothing runs, its
  // block-mode session starts by itself -- one session per block occurrence, the same id the phone
  // uses (blockSessionId), so both devices share it and its exit count. It ends with the block. A
  // session for this block that was already ended or cancelled (here or on the phone) isn't
  // restarted. This replaces starting a plain pomodoro per plan segment, which then cycled
  // focus/break until cancelled -- one cause of the "block that never ends".
  const autoStartedRef = useRef<string | null>(null);

  useEffect(() => {
    if (pomodoro.session?.active || pomodoro.isLoading || !activeSchedule) return;
    const nowDate = new Date(now);
    const id = blockSessionId(activeSchedule.id, nowDate);
    if (pomodoro.session?.id === id || autoStartedRef.current === id) return;
    const block = blockOnDay(activeSchedule, tasks, nowDate);
    if (block.endAt.getTime() - nowDate.getTime() < MIN_TRIMMED_FOCUS_MIN * 60_000) return;
    autoStartedRef.current = id;
    void pomodoro.startBlock({
      scheduleId: activeSchedule.id,
      blockStartAt: block.startAt,
      blockEndAt: block.endAt,
      profile: block.profile,
      taskId: block.tasks[0]?.id ?? currentStudySession(activeSchedule.label, tasks)?.id ?? null,
      timing: { focusMin: block.focusMin, breakMin: block.breakMin },
    });
  }, [now, pomodoro, activeSchedule, tasks]);

  // Left this block with "Salir": the block list lifts until "Volver al bloque".
  const exitedThisBlock =
    !!pomodoro.session?.active && !!pomodoro.session.pausedAt && pomodoro.session.scheduleId === activeSchedule?.id;

  const isWorkHoursActive = rawIsWorkHoursActive && !workHoursDismissed;

  const matchedLocationTrigger = useMemo(() => {
    if (!currentPosition) {
      return null;
    }
    return (
      locationTriggers.find((trigger) =>
        isWithinRadius(
          currentPosition,
          { latitude: trigger.latitude as number, longitude: trigger.longitude as number },
          trigger.radiusMeters as number,
        ),
      ) ?? null
    );
  }, [currentPosition, locationTriggers]);

  const rawIsLocationActive = matchedLocationTrigger != null;

  // Same "resets once you leave" behavior as the work-hours dismissal, so leaving the geofence
  // and coming back later triggers the overlay again instead of staying dismissed forever.
  useEffect(() => {
    if (!rawIsLocationActive && locationDismissed) {
      setLocationDismissed(false);
    }
  }, [rawIsLocationActive, locationDismissed]);

  const isLocationActive = rawIsLocationActive && !locationDismissed;

  const value = useMemo<SoftFocusContextValue>(
    () => ({
      manualSoftFocus,
      manualRemainingSeconds,
      // A WORK block's pomodoro has its own overlay (BlockFocusOverlay), not this one.
      isOverlayVisible:
        (pomodoro.isBlocking && !pomodoro.session?.scheduleId) || manualSoftFocus.active || isLocationActive,
      isFocusActive:
        pomodoro.isBlocking || manualSoftFocus.active || (isWorkHoursActive && !exitedThisBlock) || isLocationActive,
      isWorkHoursActive,
      isWithinWorkSchedule: rawIsWorkHoursActive,
      isLocationActive,
      activeLocationTriggerLabel: matchedLocationTrigger?.label ?? null,
      startManualFocus,
      stopManualFocus,
      dismissWorkHoursFocus,
      dismissLocationFocus,
    }),
    [
      dismissLocationFocus,
      dismissWorkHoursFocus,
      isLocationActive,
      isWorkHoursActive,
      manualRemainingSeconds,
      manualSoftFocus,
      matchedLocationTrigger,
      pomodoro.isBlocking,
      rawIsWorkHoursActive,
      startManualFocus,
      stopManualFocus,
    ],
  );

  return <SoftFocusContext.Provider value={value}>{children}</SoftFocusContext.Provider>;
}

export function useSoftFocus(): SoftFocusContextValue {
  const context = useContext(SoftFocusContext);
  if (!context) {
    throw new Error('useSoftFocus must be used within SoftFocusProvider');
  }
  return context;
}
