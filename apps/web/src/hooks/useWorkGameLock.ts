import { useEffect, useState } from 'react';
import { isSocialDesktopApp } from '@calendar/shared';
import { isDesktop } from '../lib/desktop';
import { gameBlockIdentifier } from '../lib/gameTime/identifier';
import type { DesktopGameTimeEntry } from '../lib/gameTime/sync';
import type { DesktopAppTimeEntry } from '../lib/desktopAppTime/sync';
import { getWorkGameLimit, isGameLockReached, subscribeWorkGameLimit } from '../lib/desktop/workGameLimit';

// Re-reads the lists this often while locked, so something launched mid-lock that wasn't used
// earlier today is picked up (the Rust trackers see it within their own 5s tick) and killed.
const LOCKED_REFRESH_MS = 10_000;
// Coarse clock for the day rolling over; each deadline gets a precise timeout below.
const CLOCK_TICK_MS = 30_000;

function readStates() {
  return { games: getWorkGameLimit('GAMES'), social: getWorkGameLimit('SOCIAL') };
}

/**
 * Block-list identifiers to kill because the strict work-hours limit ran out, for as long as a
 * WORK block is active: every game tracked today (GAMES) and every standalone social client used
 * today (SOCIAL), each independently. Empty otherwise.
 */
export function useWorkGameLock(inWorkHours: boolean): string[] {
  const [now, setNow] = useState(() => Date.now());
  const [states, setStates] = useState(readStates);
  const [identifiers, setIdentifiers] = useState<string[]>([]);

  useEffect(
    () =>
      subscribeWorkGameLimit(() => {
        setStates(readStates());
        setNow(Date.now());
      }),
    [],
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
      setStates(readStates());
    }, CLOCK_TICK_MS);
    return () => window.clearInterval(interval);
  }, []);

  // Fire exactly at each deadline instead of waiting for the next coarse tick.
  useEffect(() => {
    const timeouts = [states.games.closeDeadline, states.social.closeDeadline]
      .filter((deadline): deadline is number => deadline !== null && deadline > Date.now())
      .map((deadline) => window.setTimeout(() => setNow(Date.now()), deadline - Date.now() + 50));
    return () => timeouts.forEach((timeout) => window.clearTimeout(timeout));
  }, [states.games.closeDeadline, states.social.closeDeadline]);

  const active = isDesktop && inWorkHours;
  const gamesLocked = active && isGameLockReached(states.games, now);
  const socialLocked = active && isGameLockReached(states.social, now);

  useEffect(() => {
    if (!gamesLocked && !socialLocked) {
      setIdentifiers([]);
      return;
    }

    let cancelled = false;
    async function refresh() {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const [games, apps] = await Promise.all([
          gamesLocked ? invoke<DesktopGameTimeEntry[]>('get_game_time_today') : Promise.resolve([]),
          socialLocked ? invoke<DesktopAppTimeEntry[]>('get_app_time_today') : Promise.resolve([]),
        ]);
        if (cancelled) return;
        const next = Array.from(
          new Set([
            ...(games ?? []).map(gameBlockIdentifier),
            ...(apps ?? []).filter((app) => isSocialDesktopApp(app.key)).map((app) => app.key),
          ]),
        ).sort();
        setIdentifiers((prev) => (prev.join(' ') === next.join(' ') ? prev : next));
      } catch {
        // Native side not ready; keep whatever was already being enforced.
      }
    }

    void refresh();
    const interval = window.setInterval(() => void refresh(), LOCKED_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [gamesLocked, socialLocked]);

  return identifiers;
}
