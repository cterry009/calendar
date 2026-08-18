import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';

export const PANEL_IDS = ['dashboard', 'suggestions', 'pomodoro', 'blocklist', 'fitness', 'detox', 'ritual'] as const;

export type PanelId = (typeof PANEL_IDS)[number];

interface PanelContextValue {
  activePanel: PanelId | null;
  openPanel: (panel: PanelId, extraParams?: Record<string, string>) => void;
  closePanel: () => void;
}

const PanelContext = createContext<PanelContextValue | null>(null);

function isPanelId(value: string | null): value is PanelId {
  return value !== null && (PANEL_IDS as readonly string[]).includes(value);
}

export function PanelProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawPanel = searchParams.get('panel');
  const activePanel = isPanelId(rawPanel) ? rawPanel : null;

  const openPanel = useCallback(
    (panel: PanelId, extraParams?: Record<string, string>) => {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        next.set('panel', panel);
        if (extraParams) {
          for (const [key, value] of Object.entries(extraParams)) {
            next.set(key, value);
          }
        }
        return next;
      });
    },
    [setSearchParams],
  );

  const closePanel = useCallback(() => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete('panel');
      next.delete('taskId');
      return next;
    });
  }, [setSearchParams]);

  const value = useMemo<PanelContextValue>(
    () => ({ activePanel, openPanel, closePanel }),
    [activePanel, openPanel, closePanel],
  );

  return <PanelContext.Provider value={value}>{children}</PanelContext.Provider>;
}

export function usePanel(): PanelContextValue {
  const context = useContext(PanelContext);
  if (!context) {
    throw new Error('usePanel must be used within PanelProvider');
  }
  return context;
}
