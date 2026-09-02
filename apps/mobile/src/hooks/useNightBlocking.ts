import { useEffect, useMemo } from 'react';
import { useBlockList } from './useBlockList';
import { useNightBlockEnabled } from './useNightBlockEnabled';
import { useNightWindow } from './useNightWindow';
import { setNightBlockingState, setNightWindow } from '../lib/focusBlock/api';

// Matches useFocusBlocking.ts's WORK_HOURS_CHECK_INTERVAL_MS -- same reason, see the refetch
// effect below.
const BLOCK_LIST_REFETCH_INTERVAL_MS = 30_000;

/**
 * Task 11.9. Mirrors useFocusBlocking.ts's role for the FOCUS list: computes the current
 * NIGHT-scope package list + on/off toggle and pushes it to the native AccessibilityService
 * (FocusBlockPrefs.writeNight, via lib/focusBlock/api.ts, no-ops off-Android) whenever either
 * changes. Mounted once at the app root (_layout.tsx) so this stays live for as long as the RN
 * process is alive -- same "stale if the app is fully killed until it reopens" limitation
 * useFocusBlocking.ts already documents; task 11.10 is exactly what makes the *time-window*
 * evaluation not depend on this push being fresh, but the package list/enabled flag themselves
 * still do.
 *
 * Uses its own useBlockList() instance, separate from useFocusBlocking.ts's and blocklist.tsx's --
 * same "every hook independently pulls" pattern already used throughout this port.
 */
export function useNightBlocking(): void {
  const { entries, refetch } = useBlockList();
  const [enabled] = useNightBlockEnabled();
  const { startMinutes, endMinutes } = useNightWindow();

  // Real bug found on-device (same class useFocusBlocking.ts already documents and works around
  // for the FOCUS list): this hook's own useBlockList() instance is separate from
  // blocklist.tsx's, and useBlockList's cross-instance sync only fires on an offline-queue
  // flush, never on a plain successful online mutation. Without this poll, adding an app to the
  // NIGHT list while this hook was already mounted (i.e. any time after login) never reached the
  // native side until the app was fully restarted -- confirmed via
  // /shared_prefs/focus_block_state.xml staying empty for several seconds after a real device
  // add. Same "eventually consistent, not instant" tolerance as the FOCUS list already accepts.
  useEffect(() => {
    const timerId = setInterval(() => void refetch(), BLOCK_LIST_REFETCH_INTERVAL_MS);
    return () => clearInterval(timerId);
  }, [refetch]);

  const nightPackageNames = useMemo(
    () =>
      entries
        .filter(
          (entry) =>
            entry.enabled && entry.kind === 'MOBILE_APP' && entry.platform === 'ANDROID' && entry.scope === 'NIGHT',
        )
        .map((entry) => entry.identifier),
    [entries],
  );

  useEffect(() => {
    setNightBlockingState(enabled, nightPackageNames);
  }, [enabled, nightPackageNames]);

  // Task 11.22: pushed independently of the enabled/packages effect above since it changes on its
  // own schedule (a settings edit, not a block-list mutation) -- same "push whatever changed"
  // shape, no reason to couple them into one effect.
  useEffect(() => {
    setNightWindow(startMinutes, endMinutes);
  }, [startMinutes, endMinutes]);
}
