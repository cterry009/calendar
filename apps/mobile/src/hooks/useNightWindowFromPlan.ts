import { useCallback, useEffect } from 'react';
import { useSync } from '../context/SyncContext';
import { getNightWindowSnapshot, setNightWindowPersisted } from '../lib/nightBlock/state';
import { planOf } from '../lib/plan/api';
import { pullSnapshot } from '../lib/sync/api';

// The night window is one setting for the phone and the PC (2026-10-15: each kept its own and they
// drifted apart), stored in the synced study plan. This applies the plan's window here whenever it
// differs; editing it on the phone writes it back (blocklist.tsx -> saveNightWindowToPlan).
// Mounted once, inside useNightBlocking.
export function useNightWindowFromPlan(): void {
  const { registerRefetch } = useSync();

  const apply = useCallback(async () => {
    try {
      const synced = planOf(await pullSnapshot())?.nightWindow;
      if (!synced) return;
      const local = getNightWindowSnapshot();
      if (local.startMinutes !== synced.startMinutes || local.endMinutes !== synced.endMinutes) {
        await setNightWindowPersisted(synced);
      }
    } catch {
      // Offline: keep the window this phone already has.
    }
  }, []);

  useEffect(() => {
    void apply();
  }, [apply]);

  useEffect(() => registerRefetch(apply), [registerRefetch, apply]);
}
