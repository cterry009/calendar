import {
  DEFAULT_POMODORO_CONFIG,
  createPomodoroSession,
  getPhaseDurationMinutes,
  isBlockingPhase,
  isPhaseAbandoned,
  transitionPomodoro,
  type PomodoroEvent,
} from '@calendar/shared';
import * as Crypto from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useNotifications } from './NotificationsContext';
import { useSync } from './SyncContext';
import { ApiError } from '../lib/auth/api';
import { sendLocalNotification } from '../lib/notifications/api';
import { buildPomodoroPayload, syncPomodoroBatch } from '../lib/pomodoro/api';
import { getRemainingSeconds } from '../lib/pomodoro/timer';
import type { PomodoroConfigFormValues, SyncPomodoroRecord } from '../lib/pomodoro/types';
import { pullSnapshot } from '../lib/sync/api';

interface PomodoroContextValue {
  session: SyncPomodoroRecord | null;
  config: PomodoroConfigFormValues;
  remainingSeconds: number;
  phaseDurationMinutes: number | null;
  isBlocking: boolean;
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  notificationsEnabled: boolean;
  toggleNotifications: (enabled: boolean) => Promise<void>;
  refetch: () => Promise<void>;
  start: (taskId?: string | null) => Promise<void>;
  cancel: () => Promise<void>;
  reset: () => Promise<void>;
}

const PomodoroContext = createContext<PomodoroContextValue | null>(null);

const DEFAULT_CONFIG_VALUES: PomodoroConfigFormValues = {
  focusDurationMin: DEFAULT_POMODORO_CONFIG.focusDurationMin,
  shortBreakMin: DEFAULT_POMODORO_CONFIG.shortBreakMin,
  longBreakMin: DEFAULT_POMODORO_CONFIG.longBreakMin,
  cyclesBeforeLongBreak: DEFAULT_POMODORO_CONFIG.cyclesBeforeLongBreak,
};

function toConfig(session: SyncPomodoroRecord | null): PomodoroConfigFormValues {
  if (!session) {
    return DEFAULT_CONFIG_VALUES;
  }

  return {
    focusDurationMin: session.focusDurationMin,
    shortBreakMin: session.shortBreakMin,
    longBreakMin: session.longBreakMin,
    cyclesBeforeLongBreak: session.cyclesBeforeLongBreak,
  };
}

function pickCurrentSession(sessions: SyncPomodoroRecord[]): SyncPomodoroRecord | null {
  if (!sessions.length) {
    return null;
  }

  const active = sessions.find((entry) => entry.active);
  if (active) {
    return active;
  }

  return [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

function withRecordMetadata(
  base: ReturnType<typeof createPomodoroSession>,
  fallback: SyncPomodoroRecord | null,
): SyncPomodoroRecord {
  const nowIso = new Date().toISOString();
  const sessionId = fallback?.id ?? base.id ?? Crypto.randomUUID();

  return {
    id: sessionId,
    taskId: base.taskId ?? null,
    state: base.state,
    focusDurationMin: base.focusDurationMin,
    shortBreakMin: base.shortBreakMin,
    longBreakMin: base.longBreakMin,
    cyclesBeforeLongBreak: base.cyclesBeforeLongBreak,
    completedCycles: base.completedCycles,
    active: base.active,
    interrupted: base.interrupted,
    startedAt: base.startedAt ?? null,
    endedAt: base.endedAt ?? null,
    createdAt: fallback?.createdAt ?? nowIso,
    updatedAt: nowIso,
  };
}

// Ported from apps/web/src/context/PomodoroContext.tsx. One remaining deliberate cut: per-request
// config overrides (web's `start(taskId, overrideConfig)`). Phase-complete notifications (cut in
// the initial mobile port, browser Notification has no native equivalent) are implemented for
// real here via expo-notifications (task 6.4) -- see lib/notifications/api.ts.
export function PomodoroProvider({ children }: { children: ReactNode }) {
  const { registerRefetch } = useSync();
  const { notificationsEnabled, toggleNotifications } = useNotifications();
  const [session, setSession] = useState<SyncPomodoroRecord | null>(null);
  const [config, setConfig] = useState<PomodoroConfigFormValues>(DEFAULT_CONFIG_VALUES);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const transitionInFlightRef = useRef(false);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await pullSnapshot();
      const nextSession = pickCurrentSession(data.pomodoroSessions ?? []);
      setSession(nextSession);
      setConfig(toConfig(nextSession));
      setNow(Date.now());
    } catch (errorValue) {
      setError(errorValue instanceof ApiError ? errorValue.message : 'No se pudo cargar la sesion pomodoro.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => registerRefetch(refetch), [registerRefetch, refetch]);

  const persistSession = useCallback(
    async (nextSession: SyncPomodoroRecord) => {
      setIsMutating(true);
      setError(null);

      try {
        await syncPomodoroBatch([buildPomodoroPayload(nextSession)]);
        await refetch();
      } catch (errorValue) {
        setError(errorValue instanceof ApiError ? errorValue.message : 'No se pudo sincronizar la sesion pomodoro.');
        throw errorValue;
      } finally {
        setIsMutating(false);
      }
    },
    [refetch],
  );

  const transitionSession = useCallback(
    async (event: PomodoroEvent, createIfMissing = false) => {
      const currentMachine = session ? session : createIfMissing ? createPomodoroSession(Crypto.randomUUID(), config) : null;

      if (!currentMachine) {
        return;
      }

      const nextMachine = transitionPomodoro(currentMachine, event);
      if (nextMachine === currentMachine) {
        return;
      }

      const nextRecord = withRecordMetadata(nextMachine, session);
      await persistSession(nextRecord);
    },
    [config, persistSession, session],
  );

  const start = useCallback(
    async (taskId?: string | null) => {
      await transitionSession({ type: 'START', taskId: taskId || undefined }, true);
    },
    [transitionSession],
  );

  const cancel = useCallback(async () => {
    await transitionSession({ type: 'CANCEL' }, false);
  }, [transitionSession]);

  const reset = useCallback(async () => {
    await transitionSession({ type: 'RESET' }, false);
  }, [transitionSession]);

  // Wall-clock diffing (getRemainingSeconds computes phaseDuration - (now - startedAt)), not an
  // accumulated countdown -- the interval just forces a re-render, so a throttled/backgrounded
  // timer never desyncs the displayed value. The AppState listener just makes resuming from
  // background feel instant instead of waiting up to 1s for the next tick.
  useEffect(() => {
    if (!session?.active) {
      return;
    }

    const timerId = setInterval(() => setNow(Date.now()), 1000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });

    return () => {
      clearInterval(timerId);
      subscription.remove();
    };
  }, [session?.active]);

  useEffect(() => {
    if (!session?.active) {
      transitionInFlightRef.current = false;
      return;
    }

    const secondsLeft = getRemainingSeconds(session, now);
    if (secondsLeft > 0 || transitionInFlightRef.current) {
      return;
    }

    transitionInFlightRef.current = true;

    if (isPhaseAbandoned(session, now)) {
      // The app was closed/backgrounded for far longer than this phase's own grace window --
      // e.g. a leftover session from days ago. Silently end it instead of "completing" a phase
      // nobody actually experienced and auto-cycling into a fresh one (with real focus-mode
      // app-blocking, if that fresh phase is FOCUS) that nobody asked to start just now.
      void transitionSession({ type: 'CANCEL' }, false).finally(() => {
        transitionInFlightRef.current = false;
      });
      return;
    }

    const event: PomodoroEvent | null =
      session.state === 'FOCUS'
        ? { type: 'FOCUS_COMPLETE' }
        : session.state === 'SHORT_BREAK' || session.state === 'LONG_BREAK'
          ? { type: 'BREAK_COMPLETE' }
          : null;

    if (!event) {
      transitionInFlightRef.current = false;
      return;
    }

    const finishedState = session.state;

    void (async () => {
      try {
        await transitionSession(event, false);

        if (notificationsEnabled) {
          const title = finishedState === 'FOCUS' ? 'Enfoque finalizado' : 'Descanso finalizado';
          const body =
            finishedState === 'FOCUS'
              ? 'Empieza tu descanso para recuperar energia.'
              : 'Vuelve a enfoque para el siguiente ciclo.';
          await sendLocalNotification(title, body);
        }
      } finally {
        transitionInFlightRef.current = false;
      }
    })();
  }, [now, notificationsEnabled, session, transitionSession]);

  const remainingSeconds = useMemo(() => {
    if (!session) {
      return config.focusDurationMin * 60;
    }

    if (session.state === 'IDLE' || !session.active) {
      const idleDuration = getPhaseDurationMinutes({ ...session, state: 'FOCUS' }) ?? config.focusDurationMin;
      return idleDuration * 60;
    }

    return getRemainingSeconds(session, now);
  }, [config.focusDurationMin, now, session]);

  const value = useMemo<PomodoroContextValue>(
    () => ({
      session,
      config,
      remainingSeconds,
      phaseDurationMinutes: session ? getPhaseDurationMinutes(session) : null,
      isBlocking: session ? isBlockingPhase(session) : false,
      isLoading,
      isMutating,
      error,
      notificationsEnabled,
      toggleNotifications,
      refetch,
      start,
      cancel,
      reset,
    }),
    [
      config,
      error,
      isLoading,
      isMutating,
      notificationsEnabled,
      toggleNotifications,
      refetch,
      remainingSeconds,
      reset,
      session,
      start,
      cancel,
    ],
  );

  return <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>;
}

export function usePomodoro(): PomodoroContextValue {
  const context = useContext(PomodoroContext);
  if (!context) {
    throw new Error('usePomodoro must be used within PomodoroProvider');
  }
  return context;
}
