import { useCallback, useEffect, useState } from 'react';
import {
  getNightWindowSnapshot,
  setNightWindowPersisted,
  subscribeNightWindow,
  type NightWindow,
} from '../lib/nightBlock/state';

interface UseNightWindowResult extends NightWindow {
  setWindow: (next: NightWindow) => Promise<{ ok: true } | { ok: false; error: string }>;
}

// Thin React wrapper around the lib/nightBlock/state.ts singleton -- same pattern as
// useNightBlockEnabled.ts, see its doc comment for why this isn't plain local useState.
export function useNightWindow(): UseNightWindowResult {
  const [window, setWindowState] = useState<NightWindow>(getNightWindowSnapshot);

  useEffect(() => subscribeNightWindow(setWindowState), []);

  const setWindow = useCallback((next: NightWindow) => setNightWindowPersisted(next), []);

  return { ...window, setWindow };
}
