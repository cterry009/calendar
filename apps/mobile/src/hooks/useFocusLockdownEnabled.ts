import { useCallback, useEffect, useState } from 'react';
import {
  getFocusLockdownEnabledSnapshot,
  setFocusLockdownEnabledPersisted,
  subscribeFocusLockdownEnabled,
} from '../lib/focusLockdown/state';

// Thin React wrapper around the lib/focusLockdown/state.ts singleton -- see its doc comment for
// why this isn't plain local useState. Same shape as useNightBlockEnabled.
export function useFocusLockdownEnabled(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState(getFocusLockdownEnabledSnapshot);

  useEffect(() => subscribeFocusLockdownEnabled(setEnabled), []);

  const toggle = useCallback((next: boolean) => {
    void setFocusLockdownEnabledPersisted(next);
  }, []);

  return [enabled, toggle];
}
