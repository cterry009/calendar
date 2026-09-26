import { useEffect, useState } from 'react';
import { isWithinNightWindow } from '../lib/desktop/nightWindow';

// Ticks every 30s to recompute whether "now" falls inside the desktop night window -- a plain
// time-of-day check, so it can't be driven off block-list/pomodoro state changes the way
// isOverlayVisible (FOCUS scope) is; it needs its own clock.
const CHECK_INTERVAL_MS = 30_000;

export function useNightWindowActive(): boolean {
  const [isActive, setIsActive] = useState(() => isWithinNightWindow(new Date()));

  useEffect(() => {
    const check = () => setIsActive(isWithinNightWindow(new Date()));
    check();
    const interval = window.setInterval(check, CHECK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  return isActive;
}
