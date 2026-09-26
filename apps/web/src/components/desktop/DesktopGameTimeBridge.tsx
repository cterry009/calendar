import { useEffect, useRef } from 'react';
import { useSync } from '../../context/SyncContext';
import { isDesktop } from '../../lib/desktop';
import { buildDailyGameTimeUpsert, type DesktopGameTimeEntry } from '../../lib/gameTime/sync';

// Windows desktop counterpart of apps/mobile's ScreenTimeSyncBridge: polls the Rust
// game_tracking module's in-memory "today so far" totals (Steam per-game via the registry
// Running flag, Riot Client/Battle.net via known game processes -- see
// apps/desktop-tauri/src/game_tracking.rs) and pushes a daily rollup, same "dashboard trend, not
// a live counter" cadence as screen time. Renders nothing; inert in a plain browser or on mobile.
const POLL_INTERVAL_MS = 60_000;

export function DesktopGameTimeBridge() {
  const { batchSync } = useSync();
  const lastPushedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!isDesktop) return;

    let cancelled = false;

    async function pushCurrentState() {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const entries = await invoke<DesktopGameTimeEntry[]>('get_game_time_today');
        if (cancelled || !entries || entries.length === 0) return;

        const upsert = buildDailyGameTimeUpsert(entries);
        // Skip pushing an identical snapshot every tick -- totals only grow while something is
        // actively running, so this avoids a request every 60s when nothing changed.
        const key = `${upsert.date}:${upsert.totalMinutes}`;
        if (key === lastPushedKey.current) return;
        lastPushedKey.current = key;

        await batchSync({ dailyGameTime: [upsert] });
      } catch {
        // Native side not ready / not desktop / offline (batchSync already queues offline).
      }
    }

    void pushCurrentState();
    const interval = window.setInterval(() => void pushCurrentState(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [batchSync]);

  return null;
}
