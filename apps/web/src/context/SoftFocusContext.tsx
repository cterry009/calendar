import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
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
  startManualFocus: (minutes: number) => void;
  stopManualFocus: () => void;
}

const SoftFocusContext = createContext<SoftFocusContextValue | null>(null);

const DEFAULT_DURATION_MIN = 25;

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
  const [manualSoftFocus, setManualSoftFocus] = useState<ManualSoftFocusState>({
    active: false,
    endsAt: null,
    durationMin: DEFAULT_DURATION_MIN,
  });
  const [now, setNow] = useState(() => Date.now());

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

  useEffect(() => {
    if (!manualSoftFocus.active) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [manualSoftFocus.active]);

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

  const value = useMemo<SoftFocusContextValue>(
    () => ({
      manualSoftFocus,
      manualRemainingSeconds,
      isOverlayVisible: pomodoro.isBlocking || manualSoftFocus.active,
      startManualFocus,
      stopManualFocus,
    }),
    [manualRemainingSeconds, manualSoftFocus, pomodoro.isBlocking, startManualFocus, stopManualFocus],
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
