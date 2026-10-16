import { currentFocusStatus } from '@calendar/shared';
import { useEffect, useMemo, useState } from 'react';
import { usePomodoro } from '../../context/PomodoroContext';
import { useCalendarData } from '../../hooks/useCalendarData';
import { usePlan } from '../../hooks/usePlan';
import { isDesktop } from '../../lib/desktop';
import { notifySystem } from '../../lib/desktop/notify';

// Task 9.2. Bridges the pomodoro state (which lives here, in the React context) to the native
// tray built in apps/desktop/src-tauri/src/tray.rs:
//   - Rust tray menu click -> "tray://pomodoro" event -> start/cancel/reset here.
//   - state change here -> invoke("set_tray_state") -> Rust updates the menu status line + tray
//     tooltip.
// Since 2026-10-02 (user-requested) it shows what the phone's ongoing notification shows -- the
// running pomodoro *or* WORK schedule, which block it is, and the time left (packages/shared
// currentFocusStatus) -- in the tray, the window title (visible on the taskbar), and a Windows
// notification whenever a phase or a block starts.
// Renders nothing, and does nothing at all in a plain browser (isDesktop === false), so it's
// safe to mount unconditionally inside PomodoroProvider.

/** A block can start or end with nothing else changing, so the status is re-checked on a timer. */
const SCHEDULE_CHECK_MS = 30_000;
const ANNOUNCED_KEY = 'calendar:focus-status-announced';

/** mm:ss, or h:mm:ss from an hour up (a 90-minute block reads 1:29:59, not 89:59). */
function formatMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function DesktopTrayBridge() {
  const { session, remainingSeconds, start, cancel, reset } = usePomodoro();
  const { schedules, tasks } = useCalendarData();
  const { exceptions } = usePlan();
  const [tick, setTick] = useState(() => Date.now());

  // Rust tray -> pomodoro actions
  useEffect(() => {
    if (!isDesktop) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void import('@tauri-apps/api/event').then(({ listen }) =>
      listen<string>('tray://pomodoro', (event) => {
        if (event.payload === 'start') void start();
        else if (event.payload === 'cancel') void cancel();
        else if (event.payload === 'reset') void reset();
      }).then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      }),
    );

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [start, cancel, reset]);

  // A running schedule has no pomodoro ticking, so its countdown needs its own clock.
  useEffect(() => {
    if (!isDesktop) return;
    const timer = window.setInterval(() => setTick(Date.now()), session?.active ? SCHEDULE_CHECK_MS : 1000);
    return () => window.clearInterval(timer);
  }, [session?.active]);

  // remainingSeconds changes every second while a pomodoro runs; tick does the same for a schedule.
  const now = useMemo(() => new Date(), [remainingSeconds, tick]);
  const status = useMemo(
    () => currentFocusStatus({ session, schedules, tasks, now, exceptions }),
    [session, schedules, tasks, now, exceptions],
  );

  // status -> tray labels and window title
  useEffect(() => {
    if (!isDesktop) return;
    const left = status ? formatMmSs((status.endsAt.getTime() - now.getTime()) / 1000) : null;
    const statusLabel = status ? `${status.title} · ${left}` : 'Sin bloque ni pomodoro en curso';
    const tooltip = status ? `${statusLabel}\n${status.text}` : `Calendar Productivity — ${statusLabel}`;
    void import('@tauri-apps/api/core')
      .then(({ invoke }) => invoke('set_tray_state', { statusLabel, tooltip }))
      .catch(() => {
        // Tray not ready yet: nothing to update.
      });
    void import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) =>
        getCurrentWindow().setTitle(status ? `${left} · ${status.blockLabel ?? status.title} — Calendar Productivity` : 'Calendar Productivity'),
      )
      .catch(() => undefined);
  }, [status, now]);

  // A new phase or block -> one Windows notification (not again after a restart in the same one).
  useEffect(() => {
    if (!isDesktop || !status) return;
    let last: string | null = null;
    try {
      last = window.localStorage.getItem(ANNOUNCED_KEY);
    } catch {
      // No storage: announce anyway.
    }
    if (last === status.key) return;
    try {
      window.localStorage.setItem(ANNOUNCED_KEY, status.key);
    } catch {
      // Without storage a restart may announce twice; harmless.
    }
    void notifySystem(status.title, `${status.text}\nHasta las ${hhmm(status.endsAt)}`);
  }, [status?.key]);

  return null;
}
