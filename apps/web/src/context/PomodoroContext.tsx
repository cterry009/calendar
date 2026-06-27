import {
  DEFAULT_POMODORO_CONFIG,
  createPomodoroSession,
  getPhaseDurationMinutes,
  isBlockingPhase,
  transitionPomodoro,
  type PomodoroEvent,
} from '@calendar/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError } from '../lib/api';
import { useSync } from './SyncContext';
import { buildCreatePomodoroPayload, buildUpdatePomodoroPayload, syncPomodoroBatch } from '../lib/pomodoro/sync';
import { getRemainingSeconds } from '../lib/pomodoro/timer';
import type { PomodoroConfigFormValues, SyncPomodoroRecord } from '../lib/pomodoro/types';
import { useSyncRefetch } from '../hooks/useSyncRefetch';

interface PomodoroContextValue {
  session: SyncPomodoroRecord | null;
  config: PomodoroConfigFormValues;
  remainingSeconds: number;
  phaseDurationMinutes: number | null;
  isBlocking: boolean;
  notificationsEnabled: boolean;
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  syncedAt: string | null;
  refetch: () => Promise<void>;
  start: (taskId?: string | null) => Promise<void>;
  cancel: () => Promise<void>;
  reset: () => Promise<void>;
  updateConfig: (values: PomodoroConfigFormValues) => Promise<void>;
  toggleNotifications: (enabled: boolean) => Promise<void>;
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

function sanitizeConfig(values: PomodoroConfigFormValues): PomodoroConfigFormValues {
  return {
    focusDurationMin: Math.max(1, Math.floor(values.focusDurationMin)),
    shortBreakMin: Math.max(1, Math.floor(values.shortBreakMin)),
    longBreakMin: Math.max(1, Math.floor(values.longBreakMin)),
    cyclesBeforeLongBreak: Math.max(1, Math.floor(values.cyclesBeforeLongBreak)),
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

function withRecordMetadata(base: ReturnType<typeof createPomodoroSession>, fallback: SyncPomodoroRecord | null): SyncPomodoroRecord {
  const nowIso = new Date().toISOString();
  const sessionId = fallback?.id ?? base.id ?? crypto.randomUUID();

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

export function PomodoroProvider({ children }: { children: ReactNode }) {
  const { pullSnapshot } = useSync();
  const [session, setSession] = useState<SyncPomodoroRecord | null>(null);
  const [config, setConfig] = useState<PomodoroConfigFormValues>(DEFAULT_CONFIG_VALUES);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const transitionInFlightRef = useRef(false);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await pullSnapshot();
      const nextSession = pickCurrentSession((data.pomodoroSessions ?? []) as SyncPomodoroRecord[]);
      setSession(nextSession);
      setConfig(toConfig(nextSession));
      setSyncedAt(data.syncedAt);
      setNow(Date.now());
    } catch (errorValue) {
      if (errorValue instanceof ApiError) {
        setError(errorValue.message);
      } else if (errorValue instanceof Error) {
        setError(errorValue.message);
      } else {
        setError('No se pudo cargar la sesion pomodoro.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [pullSnapshot]);

  useSyncRefetch('pomodoroSessions', refetch);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const persistSession = useCallback(
    async (nextSession: SyncPomodoroRecord, isCreate: boolean) => {
      setIsMutating(true);
      setError(null);

      try {
        await syncPomodoroBatch([
          isCreate ? buildCreatePomodoroPayload(nextSession) : buildUpdatePomodoroPayload(nextSession),
        ]);
        await refetch();
      } catch (errorValue) {
        if (errorValue instanceof ApiError) {
          setError(errorValue.message);
        } else {
          setError('No se pudo sincronizar la sesion pomodoro.');
        }
        throw errorValue;
      } finally {
        setIsMutating(false);
      }
    },
    [refetch],
  );

  const transitionSession = useCallback(
    async (event: PomodoroEvent, createIfMissing = false) => {
      const currentConfig = sanitizeConfig(config);
      const currentMachine = session
        ? session
        : createIfMissing
          ? createPomodoroSession(crypto.randomUUID(), currentConfig)
          : null;

      if (!currentMachine) {
        return;
      }

      const nextMachine = transitionPomodoro(currentMachine, event);
      if (nextMachine === currentMachine) {
        return;
      }

      const nextRecord = withRecordMetadata(nextMachine, session);
      const isCreate = !session;
      await persistSession(nextRecord, isCreate);
    },
    [config, persistSession, session],
  );

  const start = useCallback(
    async (taskId?: string | null) => {
      await transitionSession(
        {
          type: 'START',
          taskId: taskId || undefined,
        },
        true,
      );
    },
    [transitionSession],
  );

  const cancel = useCallback(async () => {
    await transitionSession({ type: 'CANCEL' }, false);
  }, [transitionSession]);

  const reset = useCallback(async () => {
    await transitionSession({ type: 'RESET' }, false);
  }, [transitionSession]);

  const updateConfig = useCallback(
    async (values: PomodoroConfigFormValues) => {
      if (session?.active) {
        return;
      }

      const normalized = sanitizeConfig(values);
      setConfig(normalized);

      if (!session) {
        return;
      }

      const nextSession: SyncPomodoroRecord = {
        ...session,
        ...normalized,
        updatedAt: new Date().toISOString(),
      };

      await persistSession(nextSession, false);
    },
    [persistSession, session],
  );

  const toggleNotifications = useCallback(async (enabled: boolean) => {
    if (!enabled) {
      setNotificationsEnabled(false);
      return;
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationsEnabled(false);
      return;
    }

    if (Notification.permission === 'granted') {
      setNotificationsEnabled(true);
      return;
    }

    if (Notification.permission === 'denied') {
      setNotificationsEnabled(false);
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === 'granted');
  }, []);

  useEffect(() => {
    if (!session?.active) {
      return;
    }

    const timerId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timerId);
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

    const event: PomodoroEvent | null =
      session.state === 'FOCUS'
        ? { type: 'FOCUS_COMPLETE' }
        : session.state === 'SHORT_BREAK' || session.state === 'LONG_BREAK'
          ? { type: 'BREAK_COMPLETE' }
          : null;

    if (!event) {
      return;
    }

    transitionInFlightRef.current = true;
    const finishedState = session.state;

    void (async () => {
      try {
        await transitionSession(event, false);

        if (
          notificationsEnabled &&
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          const title = finishedState === 'FOCUS' ? 'Enfoque finalizado' : 'Descanso finalizado';
          const body =
            finishedState === 'FOCUS'
              ? 'Empieza tu descanso para recuperar energia.'
              : 'Vuelve a enfoque para el siguiente ciclo.';
          new Notification(title, { body });
        }
      } finally {
        transitionInFlightRef.current = false;
      }
    })();
  }, [notificationsEnabled, now, session, transitionSession]);

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
      notificationsEnabled,
      isLoading,
      isMutating,
      error,
      syncedAt,
      refetch,
      start,
      cancel,
      reset,
      updateConfig,
      toggleNotifications,
    }),
    [
      config,
      error,
      isLoading,
      isMutating,
      notificationsEnabled,
      refetch,
      remainingSeconds,
      reset,
      session,
      start,
      syncedAt,
      cancel,
      updateConfig,
      toggleNotifications,
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
