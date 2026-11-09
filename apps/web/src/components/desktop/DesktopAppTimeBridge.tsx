import { useEffect, useRef } from 'react';
import { useSync } from '../../context/SyncContext';
import { isDesktop } from '../../lib/desktop';
import {
  buildDailyDesktopAppTimeUpsert,
  type DesktopAppTimeEntry,
} from '../../lib/desktopAppTime/sync';

// Polls the Rust app_tracking module's in-memory "today so far" per-app foreground totals and
// pushes a daily rollup -- the generic-app counterpart of DesktopGameTimeBridge, same "dashboard
// trend, not a live counter" cadence. Renders nothing; inert in a plain browser or on mobile.
const POLL_INTERVAL_MS = 60_000;

export function DesktopAppTimeBridge() {
  const { batchSync } = useSync();
  const lastPushedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!isDesktop) return;

    let cancelled = false;

    async function pushCurrentState() {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const entries = await invoke<DesktopAppTimeEntry[]>('get_app_time_today');
        if (cancelled || !entries || entries.length === 0) return;

        const upsert = buildDailyDesktopAppTimeUpsert(entries);
        if (upsert.topApps.length === 0) return;

        // Skip pushing an identical snapshot every tick. The key includes the leading app because
        // totalMinutes alone can sit still across a tick while the split between apps moves (two
        // apps each gaining under a minute), which would otherwise silently drop that change.
        const key = `${upsert.date}:${upsert.totalMinutes}:${upsert.topApps[0].key}`;
        if (key === lastPushedKey.current) return;

        await batchSync({ dailyDesktopAppTime: [upsert] });
        // Only after the server took it -- see DesktopGameTimeBridge (2026-11-08): with the API down
        // batchSync throws rather than queueing, and an early key meant the push was never retried.
        lastPushedKey.current = key;
      } catch {
        // Native side not ready / not desktop / API unreachable: retried on the next tick.
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
