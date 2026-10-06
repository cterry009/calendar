import { activeWorkSchedule, blockOccurrenceKey, blockSessionId, currentFocusStatus, MIN_TRIMMED_FOCUS_MIN } from '@calendar/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { usePomodoro } from '../context/PomodoroContext';
import { blockToday } from '../lib/blockPrompt/block';
import { clearBlockExited, isBlockExited, markBlockExited } from '../lib/blockPrompt/exits';
import { drainOverlayExits, setFocusOverlayState } from '../lib/focusBlock/api';
import { logFocusEvent } from '../lib/focusEvents/log';
import { useCalendarData } from './useCalendarData';

// Every WORK block runs its pomodoro (user-requested, 2026-10-06):
// - When a block is on (not marked "no puedo", not left) and nothing runs, its block-mode pomodoro
//   starts by itself, so the time counts from the start.
// - The pomodoro shows over the screen (FocusOverlay.kt) at the block's start and on every unlock;
//   its "Salir" pauses the session (time stops, the exit is counted) -- applied here, back-dated.
// - "Volver al bloque" (useReturnToBlock) resumes it.
// Mounted once at the root, inside PomodoroProvider.

const CHECK_INTERVAL_MS = 30_000;

export function useBlockFocus(): void {
  const { session, startBlock, pause, isLoading } = usePomodoro();
  const { schedules, tasks, skipped, pomodoroSessions, isLoading: calendarLoading } = useCalendarData();
  const [now, setNow] = useState(() => new Date());
  const busy = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CHECK_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') setNow(new Date());
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  // What the overlay shows: the same status as the persistent notification.
  useEffect(() => {
    const status = currentFocusStatus({ session, schedules, tasks, now, skipped });
    setFocusOverlayState(
      session?.active && session.scheduleId
        ? {
            scheduleId: session.scheduleId,
            title: status?.title,
            text: status?.text,
            endsAtMs: status?.endsAt.getTime(),
            running: !session.pausedAt,
            paused: !!session.pausedAt,
            exits: session.exitCount ?? 0,
          }
        : {},
    );
  }, [session, schedules, tasks, now, skipped]);

  useEffect(() => {
    if (isLoading || calendarLoading || busy.current) return;
    busy.current = true;
    void (async () => {
      try {
        // 1. Exits made on the overlay while the app wasn't looking.
        for (const exit of drainOverlayExits()) {
          await markBlockExited(exit.key);
          const scheduleId = exit.key.split('@')[0];
          if (session?.active && session.scheduleId === scheduleId && !session.pausedAt) {
            await pause(exit.at);
          } else {
            // Left before the pomodoro even started: still an exit from that block.
            logFocusEvent({ kind: 'BLOCK_EXITED', scheduleId, meta: { beforeStart: true } });
          }
        }

        // 2. Start the block's pomodoro if it should be running and isn't.
        const work = activeWorkSchedule(schedules, now, skipped);
        if (!work || session?.active) return;
        const key = blockOccurrenceKey(work.id, now);
        if (await isBlockExited(key)) return;
        // Ended or cancelled on purpose (here or on the PC): don't bring it back.
        const id = blockSessionId(work.id, now);
        if (session?.id === id || pomodoroSessions.some((s) => s.id === id)) return;
        const block = blockToday({ scheduleId: work.id, startMinute: work.startMinute, endMinute: work.endMinute }, tasks, now);
        if (block.endAt.getTime() - now.getTime() < MIN_TRIMMED_FOCUS_MIN * 60_000) return;
        await startBlock({
          scheduleId: work.id,
          blockStartAt: block.startAt,
          blockEndAt: block.endAt,
          profile: block.profile,
          taskId: block.tasks[0]?.id ?? null,
        });
      } catch {
        // Next tick tries again.
      } finally {
        busy.current = false;
      }
    })();
  }, [now, isLoading, calendarLoading, schedules, skipped, tasks, session, pomodoroSessions, pause, startBlock]);
}

/** "Salir" and "Volver al bloque" from inside the app. */
export function useBlockExit() {
  const { session, pause, resume, startBlock } = usePomodoro();
  const { schedules, tasks, skipped } = useCalendarData();

  const leave = useCallback(async () => {
    if (!session?.active || !session.scheduleId || session.pausedAt) return;
    await markBlockExited(blockOccurrenceKey(session.scheduleId, new Date()));
    await pause();
  }, [session, pause]);

  const comeBack = useCallback(async () => {
    const now = new Date();
    if (session?.active && session.pausedAt && session.scheduleId) {
      await clearBlockExited(blockOccurrenceKey(session.scheduleId, now));
      await resume();
      return;
    }
    // Left before it started: start it now.
    const work = activeWorkSchedule(schedules, now, skipped);
    if (!work) return;
    await clearBlockExited(blockOccurrenceKey(work.id, now));
    const block = blockToday({ scheduleId: work.id, startMinute: work.startMinute, endMinute: work.endMinute }, tasks, now);
    await startBlock({
      scheduleId: work.id,
      blockStartAt: block.startAt,
      blockEndAt: block.endAt,
      profile: block.profile,
      taskId: block.tasks[0]?.id ?? null,
    });
  }, [session, resume, startBlock, schedules, skipped, tasks]);

  return { leave, comeBack, isOut: !!session?.active && !!session.pausedAt, exits: session?.exitCount ?? 0 };
}
