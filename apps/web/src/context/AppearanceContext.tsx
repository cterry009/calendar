import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CalendarTheme } from '@calendar/ui';

// agendaLight/agendaDark (2026-11-08): the "Agenda" look, opt-in while the web redesign lands.
export type AppearanceMode = Extract<CalendarTheme, 'dark' | 'light' | 'agendaLight' | 'agendaDark'>;
const MODES: readonly AppearanceMode[] = ['dark', 'light', 'agendaLight', 'agendaDark'];

const APPEARANCE_STORAGE_KEY = 'calendar.appearance';
// agenda-redesign 1.1 (2026-11-09): with no stored choice, the Agenda look in the system's light/dark.
function defaultAppearance(): AppearanceMode {
  if (typeof window === 'undefined' || !window.matchMedia) return 'agendaDark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'agendaLight' : 'agendaDark';
}

interface AppearanceContextValue {
  mode: AppearanceMode;
  setMode: (mode: AppearanceMode) => void;
  toggleMode: () => void;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function loadStoredMode(): AppearanceMode {
  if (typeof window === 'undefined') {
    return defaultAppearance();
  }
  const stored = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
  // 2026-11-09 (the user): the Agenda look (Fraunces + IBM Plex, graphite/cobalt) is the app's look;
  // an older stored dark/light choice becomes the Agenda mode of the same brightness.
  if (stored === 'dark') return 'agendaDark';
  if (stored === 'light') return 'agendaLight';
  return MODES.includes(stored as AppearanceMode) ? (stored as AppearanceMode) : defaultAppearance();
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
    // Flips light/dark within the same family.
    const flip: Record<AppearanceMode, AppearanceMode> = { dark: 'light', light: 'dark', agendaLight: 'agendaDark', agendaDark: 'agendaLight' };
    setMode(flip[mode]);
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
