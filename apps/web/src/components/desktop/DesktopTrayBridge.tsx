import { useEffect } from 'react';
import { usePomodoro } from '../../context/PomodoroContext';
import { isDesktop } from '../../lib/desktop';

// Task 9.2. Bridges the pomodoro state (which lives here, in the React context) to the native
// tray built in apps/desktop/src-tauri/src/tray.rs:
//   - Rust tray menu click -> "tray://pomodoro" event -> start/cancel/reset here.
//   - state change here -> invoke("set_tray_state") -> Rust updates the menu status line + tray
//     tooltip.
// Renders nothing, and does nothing at all in a plain browser (isDesktop === false), so it's
// safe to mount unconditionally inside PomodoroProvider.

function formatMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function phaseLabel(state: string | undefined, active: boolean | undefined): string {
  if (!active) return 'Pomodoro inactivo';
  switch (state) {
    case 'FOCUS':
      return 'Enfoque';
    case 'SHORT_BREAK':
      return 'Descanso corto';
    case 'LONG_BREAK':
      return 'Descanso largo';
    default:
      return 'Pomodoro';
  }
}

export function DesktopTrayBridge() {
  const { session, remainingSeconds, start, cancel, reset } = usePomodoro();

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

  // pomodoro state -> tray labels (fires ~1x/s while running, which is exactly the tray clock cadence)
  useEffect(() => {
    if (!isDesktop) return;
    const label = phaseLabel(session?.state, session?.active);
    const statusLabel = session?.active ? `${label} · ${formatMmSs(remainingSeconds)}` : label;
    void import('@tauri-apps/api/core')
      .then(({ invoke }) =>
        invoke('set_tray_state', {
          statusLabel,
          tooltip: `Calendar Productivity — ${statusLabel}`,
        }),
      )
      .catch(() => {
        // Tray not ready yet / non-desktop: nothing to update.
      });
  }, [session?.active, session?.state, remainingSeconds]);

  return null;
}
