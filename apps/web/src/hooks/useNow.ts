import { useEffect, useMemo, useState } from 'react';

// 2026-11-09: the desktop app stays open for days (minimized to the tray), so anything that read
// `new Date()` once kept yesterday as "today" and the calendar's now line never moved. These re-read
// the clock every 30 s and whenever the window comes back into view.

export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    const id = window.setInterval(tick, intervalMs);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
  return now;
}

/** Local day key: changes exactly when the day does. */
export function dayKeyOf(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/** Today's midnight, the same object until the day changes (keyed on the day, not on `now`). */
export function useToday(): Date {
  const key = dayKeyOf(useNow());
  return useMemo(() => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [key]);
}
