import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CalendarTheme } from '@calendar/ui';

export type AppearanceMode = Extract<CalendarTheme, 'dark' | 'light'>;

const APPEARANCE_STORAGE_KEY = 'calendar.appearance';
const DEFAULT_APPEARANCE: AppearanceMode = 'dark';

interface AppearanceContextValue {
  mode: AppearanceMode;
  setMode: (mode: AppearanceMode) => void;
  toggleMode: () => void;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function loadStoredMode(): AppearanceMode {
  if (typeof window === 'undefined') {
    return DEFAULT_APPEARANCE;
  }
  const stored = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : DEFAULT_APPEARANCE;
}

/**
 * Drives which Tamagui theme `CalendarProvider` renders. Lives above it in `main.tsx` (see
 * `Root`) since the provider itself only accepts a static theme prop -- this is what makes that
 * prop dynamic. Also stamps `data-theme` on <html> so plain CSS (the `.glass-surface` nav
 * backdrop in index.html, which Tamagui tokens can't reach) can react to the same switch.
 */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppearanceMode>(loadStoredMode);

  const setMode = useCallback((next: AppearanceMode) => {
    setModeState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(APPEARANCE_STORAGE_KEY, next);
    }
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = mode;
    }
  }, [mode]);

  const value = useMemo<AppearanceContextValue>(() => ({ mode, setMode, toggleMode }), [mode, setMode, toggleMode]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceContextValue {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error('useAppearance must be used within AppearanceProvider');
  }
  return context;
}
