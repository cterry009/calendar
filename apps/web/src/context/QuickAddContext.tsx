import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

interface QuickAddContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const QuickAddContext = createContext<QuickAddContextValue | null>(null);

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // "Q", no modifiers, and not while typing somewhere else -- a single-key shortcut works from
  // any page/panel without a Cmd/Ctrl chord, mirroring Superhuman/Linear's quick-capture key.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isOpen) return;
      if (event.key.toLowerCase() !== 'q') return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      event.preventDefault();
      open();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, open]);

  const value = useMemo<QuickAddContextValue>(() => ({ isOpen, open, close }), [isOpen, open, close]);

  return <QuickAddContext.Provider value={value}>{children}</QuickAddContext.Provider>;
}

export function useQuickAdd(): QuickAddContextValue {
  const context = useContext(QuickAddContext);
  if (!context) {
    throw new Error('useQuickAdd must be used within QuickAddProvider');
  }
  return context;
}
