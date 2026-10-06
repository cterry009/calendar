import { currentFocusStatus } from '@calendar/shared';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { usePomodoro } from '../context/PomodoroContext';
import { clearFocusStatus, setFocusStatus } from '../lib/focusBlock/api';
import { useCalendarData } from './useCalendarData';

/** A block can start or end with nothing else changing, so the status is re-checked on a timer. */
const CHECK_INTERVAL_MS = 30_000;

/**
 * Keeps the persistent notification in line with what's running (user-requested, 2026-10-02):
 * whenever a pomodoro or a WORK schedule is on, it shows which block, the phase or the block's
 * profile, the task, and a live countdown to the end of the phase or block. Same text as the
 * desktop tray (packages/shared currentFocusStatus). Mounted once at the root, inside
 * PomodoroProvider.
 */
export function useFocusStatusNotification(): void {
  const { session } = usePomodoro();
  const { schedules, tasks, skipped, refetch } = useCalendarData();
  const [now, setNow] = useState(() => new Date());
  const shown = useRef<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CHECK_INTERVAL_MS);
    // The phone gets no live updates: a block added or changed elsewhere shows up when the app
    // comes back to the front.
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        setNow(new Date());
        void refetch();
      }
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [refetch]);

  useEffect(() => {
    const status = currentFocusStatus({ session, schedules, tasks, now, skipped });
    // Only touch the notification when its content changes; the countdown runs natively.
    const signature = status ? `${status.title}|${status.text}|${status.endsAt.getTime()}` : null;
    if (signature === shown.current) return;
    shown.current = signature;
    if (status) setFocusStatus(status.title, status.text, status.endsAt);
    else clearFocusStatus();
  }, [session, schedules, tasks, now, skipped]);
}
