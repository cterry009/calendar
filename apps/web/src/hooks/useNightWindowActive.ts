import { useEffect, useState } from 'react';
import { subscribeNightSettings, getNightSettings, type NightSettings } from '../lib/desktop/nightWindow';

// Ticks every 30s to recompute whether "now" falls inside the desktop night window -- a plain
// time-of-day check, so it can't be driven off block-list/pomodoro state changes the way
// isOverlayVisible (FOCUS scope) is; it needs its own clock.
const CHECK_INTERVAL_MS = 30_000;

export function useNightSettings(): NightSettings {
  const [settings, setSettings] = useState(getNightSettings);
  useEffect(() => subscribeNightSettings(setSettings), []);
  return settings;
}

/** The time, every 30s: each app has its own start now (weekend-mode), so callers do the check. */
export function useNightClock(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), CHECK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  return now;
}
