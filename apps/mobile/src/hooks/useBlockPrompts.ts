import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { usePomodoro } from '../context/PomodoroContext';
import { blockTaskId, blockToday, localDateAt } from '../lib/blockPrompt/block';
import {
  BLOCK_PROMPT_DECLINE,
  BLOCK_PROMPT_SNOOZE,
  BLOCK_PROMPT_START,
  ensureBlockPromptCategory,
  isBlockPromptData,
  isWeeklyPlanData,
  scheduleBlockPrompts,
  snoozeBlockPrompt,
} from '../lib/blockPrompt/notifications';
import { markBlockSkipped } from '../lib/calendar/skips';
import { logFocusEvent } from '../lib/focusEvents/log';
import { useCalendarData } from './useCalendarData';

// A notification at the start of every WORK block: "Iniciar" starts a block-mode pomodoro with the
// block's attention profile (its most demanding task's) on its first task; "En 5 min" asks again;
// "Hoy no" lets it go. Every answer is logged as a FocusEvent with how late it came, and the
// pomodoro logs the rest (PomodoroContext). The Friday "plan de la semana" block also gets a
// notification that opens the weekly plan. Mounted once at the root, inside PomodoroProvider.

/** Rescheduling cancels and recreates ~40 alarms; wait for a burst of changes to settle. */
const RESCHEDULE_DELAY_MS = 2_000;

export function useBlockPrompts(): void {
  const { schedules, tasks, skipped, isLoading: calendarLoading, refetch } = useCalendarData();
  const { startBlock, isLoading: pomodoroLoading } = usePomodoro();
  const pending = useRef<Notifications.NotificationResponse[]>([]);
  const handled = useRef(new Set<string>());
  const ready = !calendarLoading && !pomodoroLoading;

  // Latest values for the response handler, which outlives renders.
  const state = useRef({ tasks, startBlock });
  state.current = { tasks, startBlock };

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void ensureBlockPromptCategory();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android' || calendarLoading) return;
    const timer = setTimeout(() => void scheduleBlockPrompts(schedules, tasks, skipped), RESCHEDULE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [schedules, tasks, skipped, calendarLoading]);

  // The phone gets no live updates from the server, so a block or task changed on another device
  // would keep its old prompt until the app restarted. Re-pull whenever the app comes to the front.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refetch();
    });
    return () => subscription.remove();
  }, [refetch]);

  const process = useRef(async () => {
    while (pending.current.length) {
      const response = pending.current.shift()!;
      await handle(response, handled.current, state.current);
    }
  });

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    // An answer that launched the app arrives before any listener exists.
    const launch = Notifications.getLastNotificationResponse();
    if (launch) {
      pending.current.push(launch);
      Notifications.clearLastNotificationResponse();
    }
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      pending.current.push(response);
      Notifications.clearLastNotificationResponse();
      if (ready) void process.current();
    });
    return () => subscription.remove();
  }, [ready]);

  // Answers wait until tasks and the current session are loaded, so "Iniciar" picks the right task.
  useEffect(() => {
    if (ready) void process.current();
  }, [ready]);
}

async function handle(
  response: Notifications.NotificationResponse,
  handled: Set<string>,
  { tasks, startBlock }: { tasks: Parameters<typeof blockToday>[1]; startBlock: ReturnType<typeof usePomodoro>['startBlock'] },
): Promise<void> {
  const { request, date } = response.notification;
  const data = request.content.data;

  const key = `${request.identifier}@${date}#${response.actionIdentifier}`;
  if (handled.has(key)) return;
  handled.add(key);

  if (isWeeklyPlanData(data)) {
    router.push('/plan');
    return;
  }
  if (!isBlockPromptData(data)) return;

  const now = new Date();
  const blockStartAt = localDateAt(data.startMinute, new Date(date));
  const block = blockToday(data, tasks, now);
  const base = {
    scheduleId: data.scheduleId,
    blockStartAt: blockStartAt.toISOString(),
    attentionProfile: block.profile,
    taskId: block.tasks[0]?.id,
    // How late the answer came, in seconds after the block's start.
    value: Math.round((now.getTime() - blockStartAt.getTime()) / 1000),
    meta: { snoozes: data.snoozes, tasksInBlock: block.tasks.length },
  };

  switch (response.actionIdentifier) {
    case BLOCK_PROMPT_START: {
      const sessionId = await startBlock({
        scheduleId: data.scheduleId,
        blockStartAt,
        blockEndAt: block.endAt,
        profile: block.profile,
        taskId: blockTaskId(block, data.label, tasks),
        timing: { focusMin: block.focusMin, breakMin: block.breakMin },
      });
      logFocusEvent({
        kind: 'BLOCK_PROMPT_ACCEPTED',
        ...base,
        pomodoroSessionId: sessionId ?? undefined,
        meta: { ...base.meta, started: sessionId !== null },
      });
      break;
    }
    case BLOCK_PROMPT_SNOOZE:
      logFocusEvent({ kind: 'BLOCK_PROMPT_SNOOZED', ...base });
      await snoozeBlockPrompt(data, request.content.body ?? '¿Lo inicias?').catch(() => undefined);
      break;
    case BLOCK_PROMPT_DECLINE:
      logFocusEvent({ kind: 'BLOCK_PROMPT_DECLINED', ...base });
      // "Hoy no" is "no puedo hacer este bloque": no overlay, no blocking, not counted as missed.
      await markBlockSkipped(data.scheduleId, blockStartAt).catch(() => undefined);
      break;
    default:
      logFocusEvent({ kind: 'BLOCK_PROMPT_OPENED', ...base });
  }
  await Notifications.dismissNotificationAsync(request.identifier).catch(() => undefined);
}
