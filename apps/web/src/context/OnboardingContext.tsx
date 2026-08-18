import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { OnboardingTutorial } from '../components/onboarding/OnboardingTutorial';
import { useAuth } from './AuthContext';
import { isTutorialCompleted, markTutorialCompleted } from '../lib/onboarding/storage';

interface OnboardingContextValue {
  isOpen: boolean;
  openTutorial: () => void;
  closeTutorial: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (user && !isTutorialCompleted()) {
      setIsOpen(true);
    }
  }, [user]);

  const openTutorial = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeTutorial = useCallback(() => {
    markTutorialCompleted();
    setIsOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      openTutorial,
      closeTutorial,
    }),
    [closeTutorial, isOpen, openTutorial],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      <OnboardingTutorial open={isOpen} onFinish={closeTutorial} />
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }

  return context;
}
