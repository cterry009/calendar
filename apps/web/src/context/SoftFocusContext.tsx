import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { isWithinRadius } from '@calendar/shared';
import { useFocusTriggers } from '../hooks/useFocusTriggers';
import { useSchedules } from '../hooks/useSchedules';
import { findActiveWorkSchedule, isNowWithinWorkSchedule } from '../lib/calendar/utils';
import { generateFocusPlan, resolveFocusPlanConfig } from '../lib/pomodoro/planner';
import { usePomodoro } from './PomodoroContext';

interface ManualSoftFocusState {
  active: boolean;
  endsAt: string | null;
  durationMin: number;
}

interface SoftFocusContextValue {
  manualSoftFocus: ManualSoftFocusState;
  manualRemainingSeconds: number;
  isOverlayVisible: boolean;
  isWorkHoursActive: boolean;
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

  const rawIsWorkHoursActive = useMemo(
    () => isNowWithinWorkSchedule(schedules, new Date(now)),
    [schedules, now],
  );

  // A dismissal only lasts for the remainder of the current work block: once we're no longer
  // inside any enabled WORK schedule, the flag resets so the next block triggers normally.
  useEffect(() => {
    if (!rawIsWorkHoursActive && workHoursDismissed) {
      setWorkHoursDismissed(false);
    }
  }, [rawIsWorkHoursActive, workHoursDismissed]);

  // Pomodoros activate on their own: whenever "now" lands inside a pomodoro segment of the
  // active WORK schedule's auto-plan, start a session for it -- no manual "Iniciar" needed.
  // A ref (not state) tracks the last segment we already started, so this only fires once per
  // segment instead of on every tick, and a manual cancel during that segment isn't overridden.
  const autoStartedSegmentKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (pomodoro.session?.active) return;

    const nowDate = new Date(now);
    const activeSchedule = findActiveWorkSchedule(schedules, nowDate);
    if (!activeSchedule) return;

    const config = resolveFocusPlanConfig({
      startMinute: activeSchedule.startMinute,
      endMinute: activeSchedule.endMinute,
      pomodoroMin: activeSchedule.pomodoroMin,
      shortBreakMin: activeSchedule.shortBreakMin,
      longBreakMin: activeSchedule.longBreakMin,
      pomodorosPerChunk: activeSchedule.pomodorosPerChunk,
      chunks: activeSchedule.chunks,
    });

    const plan = generateFocusPlan(activeSchedule.startMinute, activeSchedule.endMinute, config);
    const nowMinute = nowDate.getHours() * 60 + nowDate.getMinutes();
    const currentSegment = plan.find((segment) => nowMinute >= segment.startMinute && nowMinute < segment.endMinute);
    if (!currentSegment || currentSegment.type !== 'pomodoro') return;

    const segmentKey = `${activeSchedule.id}-${nowDate.toDateString()}-${currentSegment.startMinute}`;
    if (autoStartedSegmentKeyRef.current === segmentKey) return;

    autoStartedSegmentKeyRef.current = segmentKey;
    void pomodoro.start(undefined, {
      focusDurationMin: currentSegment.endMinute - currentSegment.startMinute,
      shortBreakMin: config.shortBreakMin,
      longBreakMin: config.longBreakMin,
      cyclesBeforeLongBreak: config.pomodorosPerChunk,
    });
  }, [now, pomodoro, schedules]);

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
      isOverlayVisible: pomodoro.isBlocking || manualSoftFocus.active || isWorkHoursActive || isLocationActive,
      isWorkHoursActive,
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
