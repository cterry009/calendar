import { useCallback, useEffect, useState } from 'react';
import {
  getNightBlockEnabledSnapshot,
  setNightBlockEnabledPersisted,
  subscribeNightBlockEnabled,
} from '../lib/nightBlock/state';

// Thin React wrapper around the lib/nightBlock/state.ts singleton -- see its doc comment for why
// this isn't plain local useState.
export function useNightBlockEnabled(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState(getNightBlockEnabledSnapshot);

  useEffect(() => subscribeNightBlockEnabled(setEnabled), []);

  const toggle = useCallback((next: boolean) => {
    void setNightBlockEnabledPersisted(next);
  }, []);

  return [enabled, toggle];
}
