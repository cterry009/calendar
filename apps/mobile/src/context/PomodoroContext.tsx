import {
  DEFAULT_POMODORO_CONFIG,
  blockSessionId,
  createBlockPomodoroSession,
  createPomodoroSession,
  getPhaseDurationMinutes,
  isBlockingPhase,
  isPhaseAbandoned,
  pomodoroTransitionEvents,
  transitionPomodoro,
  type AttentionProfile,
  type PomodoroEvent,
} from '@calendar/shared';
import * as Crypto from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useNotifications } from './NotificationsContext';
import { useSync } from './SyncContext';
import { ApiError } from '../lib/auth/api';
import { logFocusEvent } from '../lib/focusEvents/log';
import { platformStorage } from '../lib/platformStorage';
import { sendLocalNotification } from '../lib/notifications/api';
import { playPomodoroChime } from '../lib/pomodoro/chime';
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
  /** Starts a session for a WORK block: its id, or null if one is already running or the block is nearly over. */
  startBlock: (block: StartBlockOptions) => Promise<string | null>;
  cancel: () => Promise<void>;
  reset: () => Promise<void>;
  /** "Salir": stop counting (from `at` when the exit was recorded elsewhere). */
  pause: (at?: string) => Promise<void>;
  /** "Volver al bloque". */
  resume: () => Promise<void>;
}

export interface StartBlockOptions {
  scheduleId: string;
  blockStartAt: Date;
  blockEndAt: Date;
  profile: AttentionProfile;
  taskId?: string | null;
  /** The block's pomodoro and break (blockOnDay); the profile's when omitted. */
  timing?: { focusMin: number; breakMin: number };
}

/** Which block a running session belongs to, for the events it logs. */
interface BlockContext {
  sessionId: string;
  scheduleId: string;
  blockStartAt?: string;
}

const PomodoroContext = createContext<PomodoroContextValue | null>(null);

// Kept on disk, not just in memory: a 90-minute block easily outlives the app process (Android
// reclaims it), and every event the session logs after that still has to name its block.
const BLOCK_CONTEXT_KEY = 'calendar:pomodoro-block-context';

async function loadBlockContext(): Promise<BlockContext | null> {
  try {
    const raw = await platformStorage.getItem(BLOCK_CONTEXT_KEY);
    return raw ? (JSON.parse(raw) as BlockContext) : null;
  } catch {
    return null;
  }
}

function saveBlockContext(context: BlockContext): void {
  void platformStorage.setItem(BLOCK_CONTEXT_KEY, JSON.stringify(context)).catch(() => undefined);
}


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

  // The most recently touched active one: sessions abandoned months ago (test runs, a closed app)
  // can still be flagged active, and taking whichever came first sometimes showed one of those
  // instead of the block running now -- a block that seemed to never end (2026-10-06).
  // Ignoring ones whose phase ended long ago: nobody is running those, and taking one blocked the
  // block's own pomodoro from starting.
  const now = Date.now();
  const active = sessions
    .filter((entry) => entry.active && (entry.pausedAt || !isPhaseAbandoned(entry, now)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (active) {
    return active;
  }

  // Nothing running: the latest one, minus the abandoned "active" ones (shown as running they'd
  // block the next block's pomodoro just the same).
  return (
    [...sessions]
      .filter((entry) => !entry.active)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
  );
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
    blockEndAt: base.blockEndAt ?? null,
    attentionProfile: base.attentionProfile ?? null,
    scheduleId: base.scheduleId ?? null,
    pausedAt: base.pausedAt ?? null,
    exitCount: base.exitCount ?? 0,
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
  const blockContextRef = useRef<BlockContext | null>(null);

  useEffect(() => {
    void loadBlockContext().then((saved) => {
      if (saved && !blockContextRef.current) blockContextRef.current = saved;
    });
  }, []);

  const logTransition = useCallback((prev: SyncPomodoroRecord | null, next: SyncPomodoroRecord, reason?: string) => {
    const block =
      blockContextRef.current?.sessionId === next.id
        ? blockContextRef.current
        : next.scheduleId
          ? { sessionId: next.id, scheduleId: next.scheduleId, blockStartAt: undefined }
          : null;
    for (const event of pomodoroTransitionEvents(prev, next, reason)) {
      logFocusEvent({
        ...event,
        pomodoroSessionId: next.id,
        taskId: next.taskId ?? undefined,
        attentionProfile: next.attentionProfile ?? undefined,
        scheduleId: block?.scheduleId,
        blockStartAt: block?.blockStartAt,
      });
    }
  }, []);

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
        const response = await syncPomodoroBatch([buildPomodoroPayload(nextSession)]);
        if (response.queued) {
          // The mutation only got queued (offline, or a failed online request) -- a refetch()
          // here would pull the stale pre-mutation snapshot (server or offline cache) and revert
          // this change right back, e.g. leaving a just-cancelled session looking active again and
          // the total-lockdown block never lifting no matter how many times the user cancels. We
          // already know the intended next state, so apply it directly instead of round-tripping.
          setSession(nextSession);
          setConfig(toConfig(nextSession));
          setNow(Date.now());
        } else {
          await refetch();
        }
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
    async (event: PomodoroEvent, createIfMissing = false, reason?: string) => {
      // A finished block session is tied to that block's end: a plain start begins a new session
      // instead of reusing it (it would have no minutes left).
      const reusable = session && !(event.type === 'START' && session.blockEndAt) ? session : null;
      const currentMachine = reusable ?? (createIfMissing ? createPomodoroSession(Crypto.randomUUID(), config) : null);

      if (!currentMachine) {
        return;
      }

      const nextMachine = transitionPomodoro(currentMachine, event);
      if (nextMachine === currentMachine) {
        return;
      }

      const nextRecord = withRecordMetadata(nextMachine, reusable);
      await persistSession(nextRecord);
      logTransition(reusable, nextRecord, reason);
    },
    [config, logTransition, persistSession, session],
  );

  const startBlock = useCallback(
    async ({ scheduleId, blockStartAt, blockEndAt, profile, taskId, timing }: StartBlockOptions) => {
      const id = blockSessionId(scheduleId, blockStartAt);
      // Already in this block but left it ("Salir"): starting it again is coming back.
      if (session?.active && session.id === id && session.pausedAt) {
        const resumed = transitionPomodoro(session, { type: 'RESUME' });
        const record = withRecordMetadata(resumed, session);
        await persistSession(record);
        logTransition(session, record);
        return record.id;
      }
      if (session?.active) return null;
      // One session per block occurrence, the same id on every device, so the phone and the PC
      // starting the same block at once land on one row instead of two.
      const base = { ...createBlockPomodoroSession(id, profile, blockEndAt.toISOString(), timing), scheduleId };
      const started = transitionPomodoro(base, { type: 'START', taskId: taskId ?? undefined });
      if (started === base) return null;
      const record = withRecordMetadata(started, session?.id === id ? session : null);
      blockContextRef.current = { sessionId: record.id, scheduleId, blockStartAt: blockStartAt.toISOString() };
      saveBlockContext(blockContextRef.current);
      await persistSession(record);
      logTransition(null, record);
      return record.id;
    },
    [logTransition, persistSession, session?.active],
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

  // "Salir" / "Volver al bloque" (2026-10-06). `at`: when the exit really happened (the phone's
  // overlay records it natively and the app applies it later).
  const pause = useCallback(
    async (at?: string) => {
      await transitionSession({ type: 'PAUSE', at }, false);
    },
    [transitionSession],
  );

  const resume = useCallback(async () => {
    await transitionSession({ type: 'RESUME' }, false);
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

    if (session.pausedAt) {
      // Out of the block when it ended: close it (resuming past the end ends the block).
      const blockEnd = session.blockEndAt ? new Date(session.blockEndAt).getTime() : null;
      if (blockEnd !== null && now >= blockEnd && !transitionInFlightRef.current) {
        transitionInFlightRef.current = true;
        void transitionSession({ type: 'RESUME' }, false).finally(() => {
          transitionInFlightRef.current = false;
        });
      }
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
      void transitionSession({ type: 'CANCEL' }, false, 'abandoned').finally(() => {
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

        // Sound cue on every real phase completion, regardless of notification permission.
        playPomodoroChime();

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
      startBlock,
      cancel,
      reset,
      pause,
      resume,
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
      startBlock,
      cancel,
      pause,
      resume,
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
