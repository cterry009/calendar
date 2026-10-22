import {
  DEFAULT_POMODORO_CONFIG,
  blockSessionId,
  canCutSegment,
  createBlockPomodoroSession,
  createFlexibleBlockSession,
  createPomodoroSession,
  createSequenceBlockSession,
  flexibleBlockSessionId,
  nextFlexibleBlockNumber,
  getPhaseDurationMinutes,
  isBlockingPhase,
  isPhaseAbandoned,
  pomodoroTransitionEvents,
  transitionPomodoro,
  type AttentionProfile,
  type PomodoroEvent,
  type SequenceSegment,
} from '@calendar/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError } from '../lib/api';
import { logFocusEvent } from '../lib/focusEvents/log';
import { useSync } from './SyncContext';
import { playPomodoroChime, primePomodoroChime } from '../lib/pomodoro/chime';
import { buildCreatePomodoroPayload, buildUpdatePomodoroPayload, syncPomodoroBatch } from '../lib/pomodoro/sync';
import { getRemainingSeconds } from '../lib/pomodoro/timer';
import { notifySystem } from '../lib/desktop/notify';
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
  start: (taskId?: string | null, overrideConfig?: Partial<PomodoroConfigFormValues>) => Promise<void>;
  /** Starts a session for a WORK block: its id, or null if one is already running or the block is nearly over. */
  startBlock: (block: StartBlockOptions) => Promise<string | null>;
  /** Starts a flexible morning block after its check-in (dynamic-study-blocks D16): its id, or null. */
  startFlexibleBlock: (block: StartFlexibleBlockOptions) => Promise<string | null>;
  /** Flexible block: start the next focus (or the closing) by hand, with its minutes. */
  startFocus: (minutes?: number) => Promise<void>;
  /** Flexible block: "Terminar bloque", a clean end. */
  endBlock: () => Promise<void>;
  cancel: () => Promise<void>;
  reset: () => Promise<void>;
  /** "Salir": stop counting the block's time (the exit is counted). */
  pause: () => Promise<void>;
  /** "Volver al bloque". */
  resume: () => Promise<void>;
  /** "Cortar tramo" (sequence blocks): end this focus segment and start the next pause now. */
  cutSegment: () => Promise<void>;
  canCutSegment: boolean;
  /**
   * Pomodoro `cycle` of `sessionId` was rated or dismissed here: recorded on the session so the
   * other device closes its card (2026-10-07).
   */
  markPomodoroReviewed: (sessionId: string, cycle: number) => Promise<void>;
  toggleNotifications: (enabled: boolean) => Promise<void>;
}

export interface StartBlockOptions {
  scheduleId: string;
  blockStartAt: Date;
  blockEndAt: Date;
  profile: AttentionProfile;
  taskId?: string | null;
  /** The block's pomodoro and break (blockOnDay); the profile's when omitted. */
  timing?: { focusMin: number; breakMin: number };
  /** The block's sequence, labelled for its category (horario 2026-10-19); wins over timing. */
  sequence?: SequenceSegment[] | null;
}

export interface StartFlexibleBlockOptions {
  scheduleId: string;
  /** The window's end today (12:00): no focus starts after it. */
  windowEndAt: Date | null;
  blockMin: number;
  focusMin: number;
  taskId?: string | null;
  /** The check-in, logged for calibrating the energy table (D8). */
  checkIn: {
    motivation: number;
    concentration: number;
    energy: number;
    proposed: { blockMin: number; focusMin: number };
  };
}

/** Which block a running session belongs to, for the events it logs. */
interface BlockContext {
  sessionId: string;
  scheduleId: string;
  blockStartAt: string;
}

// Kept in localStorage so a reload in the middle of a block still knows which block it is.
const BLOCK_CONTEXT_KEY = 'calendar:pomodoro-block-context';

function loadBlockContext(): BlockContext | null {
  try {
    const raw = window.localStorage.getItem(BLOCK_CONTEXT_KEY);
    return raw ? (JSON.parse(raw) as BlockContext) : null;
  } catch {
    return null;
  }
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
    blockEndAt: base.blockEndAt ?? null,
    attentionProfile: base.attentionProfile ?? null,
    scheduleId: base.scheduleId ?? null,
    pausedAt: base.pausedAt ?? null,
    exitCount: base.exitCount ?? 0,
    reviewedCycles: base.reviewedCycles ?? 0,
    blockStartAt: base.blockStartAt ?? null,
    sequence: base.sequence ?? null,
    segmentIndex: base.segmentIndex ?? null,
    cutCount: base.cutCount ?? 0,
    flexible: base.flexible ?? false,
    plannedBlockMin: base.plannedBlockMin ?? null,
    windowEndAt: base.windowEndAt ?? null,
    focusMinutes: base.focusMinutes ?? 0,
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
  // Flexible pauses already announced as over: one soft notice per pause (D5), not one per tick.
  const pauseNoticesRef = useRef(new Set<string>());
  const blockContextRef = useRef<BlockContext | null>(typeof window === 'undefined' ? null : loadBlockContext());

  const logTransition = useCallback((prev: SyncPomodoroRecord | null, next: SyncPomodoroRecord, reason?: string) => {
    const block = blockContextRef.current?.sessionId === next.id ? blockContextRef.current : null;
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
    async (event: PomodoroEvent, createIfMissing = false, overrideConfig?: Partial<PomodoroConfigFormValues>, reason?: string) => {
      const currentConfig = { ...sanitizeConfig(config), ...overrideConfig };
      // A finished block session is tied to that block's end: a plain start begins a new session.
      const reusable = session && !(event.type === 'START' && session.blockEndAt) ? session : null;
      let currentMachine = reusable
        ? reusable
        : createIfMissing
          ? createPomodoroSession(crypto.randomUUID(), currentConfig)
          : null;

      if (!currentMachine) {
        return;
      }

      if (overrideConfig && event.type === 'START' && currentMachine.state === 'IDLE') {
        currentMachine = { ...currentMachine, ...overrideConfig };
      }

      const nextMachine = transitionPomodoro(currentMachine, event);
      if (nextMachine === currentMachine) {
        return;
      }

      const nextRecord = withRecordMetadata(nextMachine, reusable);
      const isCreate = !reusable;
      await persistSession(nextRecord, isCreate);
      logTransition(reusable, nextRecord, reason);
    },
    [config, logTransition, persistSession, session],
  );

  const startBlock = useCallback(
    async ({ scheduleId, blockStartAt, blockEndAt, profile, taskId, timing, sequence }: StartBlockOptions) => {
      const id = blockSessionId(scheduleId, blockStartAt);
      // Already in this block but left it ("Salir"): starting it again is coming back.
      if (session?.active && session.id === id && session.pausedAt) {
        const resumed = withRecordMetadata(transitionPomodoro(session, { type: 'RESUME' }), session);
        await persistSession(resumed, false);
        logTransition(session, resumed);
        return resumed.id;
      }
      if (session?.active) return null;
      primePomodoroChime();
      // One session per block occurrence, the same id on the phone and here, so both starting the
      // same block land on one row (and one exit count).
      const base = {
        ...(sequence?.length
          ? createSequenceBlockSession(id, profile, blockStartAt.toISOString(), blockEndAt.toISOString(), sequence)
          : createBlockPomodoroSession(id, profile, blockEndAt.toISOString(), timing)),
        scheduleId,
      };
      const started = transitionPomodoro(base, { type: 'START', taskId: taskId ?? undefined });
      if (started === base) return null;
      const existing = session?.id === id ? session : null;
      const record = withRecordMetadata(started, existing);
      blockContextRef.current = { sessionId: record.id, scheduleId, blockStartAt: blockStartAt.toISOString() };
      try {
        window.localStorage.setItem(BLOCK_CONTEXT_KEY, JSON.stringify(blockContextRef.current));
      } catch {
        // Private mode or storage full: the events just lose their block if the page reloads.
      }
      await persistSession(record, !existing);
      logTransition(null, record);
      return record.id;
    },
    [logTransition, persistSession, session],
  );

  const startFlexibleBlock = useCallback(
    async ({ scheduleId, windowEndAt, blockMin, focusMin, taskId, checkIn }: StartFlexibleBlockOptions) => {
      if (session?.active) return null;
      primePomodoroChime();
      const now = new Date();
      // Numbered from every session of the day, so the PC and the phone agree on "block 2".
      const snapshot = await pullSnapshot();
      const n = nextFlexibleBlockNumber((snapshot.pomodoroSessions ?? []) as SyncPomodoroRecord[], scheduleId, now);
      const id = flexibleBlockSessionId(scheduleId, now, n);
      const base = {
        ...createFlexibleBlockSession(id, { blockMin, focusMin, windowEndAt: windowEndAt?.toISOString() ?? null }),
        scheduleId,
      };
      const started = transitionPomodoro(base, { type: 'START', taskId: taskId ?? undefined });
      if (started === base) return null;
      const record = withRecordMetadata(started, null);
      blockContextRef.current = { sessionId: record.id, scheduleId, blockStartAt: record.blockStartAt ?? now.toISOString() };
      try {
        window.localStorage.setItem(BLOCK_CONTEXT_KEY, JSON.stringify(blockContextRef.current));
      } catch {
        // Private mode or storage full: the events just lose their block if the page reloads.
      }
      logFocusEvent({
        kind: 'CHECK_IN',
        scheduleId,
        taskId: taskId ?? undefined,
        pomodoroSessionId: record.id,
        value: checkIn.energy,
        meta: {
          scope: 'block-start',
          motivation: checkIn.motivation,
          concentration: checkIn.concentration,
          energy: checkIn.energy,
          proposed: checkIn.proposed,
          chosen: { blockMin, focusMin },
          blockNumber: n,
          device: 'desktop',
        },
      });
      await persistSession(record, true);
      logTransition(null, record);
      return record.id;
    },
    [logTransition, persistSession, pullSnapshot, session],
  );

  const start = useCallback(
    async (taskId?: string | null, overrideConfig?: Partial<PomodoroConfigFormValues>) => {
      // Prime the chime inside this click so the browser's autoplay policy lets the
      // timer-fired play() through later when a phase completes.
      primePomodoroChime();
      await transitionSession(
        {
          type: 'START',
          taskId: taskId || undefined,
        },
        true,
        overrideConfig,
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

  const pause = useCallback(async () => {
    await transitionSession({ type: 'PAUSE' }, false);
  }, [transitionSession]);

  const resume = useCallback(async () => {
    await transitionSession({ type: 'RESUME' }, false);
  }, [transitionSession]);

  const cutSegment = useCallback(async () => {
    await transitionSession({ type: 'CUT_SEGMENT' }, false);
  }, [transitionSession]);

  const startFocus = useCallback(
    async (minutes?: number) => {
      primePomodoroChime();
      await transitionSession({ type: 'START_FOCUS', minutes }, false);
    },
    [transitionSession],
  );

  const endBlock = useCallback(async () => {
    await transitionSession({ type: 'END_BLOCK' }, false);
  }, [transitionSession]);

  const markPomodoroReviewed = useCallback(
    async (sessionId: string, cycle: number) => {
      if (!session || session.id !== sessionId || (session.reviewedCycles ?? 0) >= cycle) return;
      const next = { ...session, reviewedCycles: cycle, updatedAt: new Date().toISOString() };
      await persistSession(next, false);
    },
    [session, persistSession],
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

    const flexiblePause = !!session.flexible && session.state !== 'FOCUS';
    if (flexiblePause && !isPhaseAbandoned(session, now)) {
      // Pause automatic, focus manual (D5): the pause just waits; say once that it's over.
      const key = `${session.id}:${session.segmentIndex ?? ''}:${session.startedAt ?? ''}`;
      if (!pauseNoticesRef.current.has(key)) {
        pauseNoticesRef.current.add(key);
        playPomodoroChime();
        void notifySystem('Pausa terminada', 'Empieza el siguiente foco cuando quieras.');
      }
      return;
    }

    transitionInFlightRef.current = true;

    if (flexiblePause) {
      // A flexible pause left open an hour past its end: the block ends cleanly with the focus it has.
      void transitionSession({ type: 'END_BLOCK' }, false, undefined, 'abandoned').finally(() => {
        transitionInFlightRef.current = false;
      });
      return;
    }

    if (isPhaseAbandoned(session, now)) {
      // The app was closed/backgrounded for far longer than this phase's own grace window --
      // e.g. a leftover session from days ago. Silently end it instead of "completing" a phase
      // nobody actually experienced and auto-cycling into a fresh one (with real focus-mode
      // app-blocking, if that fresh phase is FOCUS) that nobody asked to start just now.
      void transitionSession({ type: 'CANCEL' }, false, undefined, 'abandoned').finally(() => {
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

        if (
          notificationsEnabled &&
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          const title = finishedState === 'FOCUS' ? 'Enfoque finalizado' : 'Descanso finalizado';
          const body =
            finishedState === 'FOCUS'
              ? session.flexible
                ? 'La pausa ya empezó; el siguiente foco empieza cuando lo inicies.'
                : 'Empieza tu descanso para recuperar energia.'
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
      startBlock,
      startFlexibleBlock,
      startFocus,
      endBlock,
      cancel,
      reset,
      pause,
      resume,
      cutSegment,
      // Re-evaluated every tick (now): a segment can stop being cuttable as time passes.
      canCutSegment: session ? canCutSegment(session) : false,
      markPomodoroReviewed,
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
      startBlock,
      startFlexibleBlock,
      startFocus,
      endBlock,
      syncedAt,
      cancel,
      pause,
      resume,
      cutSegment,
      markPomodoroReviewed,
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
