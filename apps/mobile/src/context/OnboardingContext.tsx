import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { OnboardingTutorial } from '../components/onboarding/OnboardingTutorial';
import { isTutorialCompleted, markTutorialCompleted } from '../lib/onboarding/storage';
import { TOURS, type TourId } from '../lib/onboarding/tours';
import { useAuth } from './AuthContext';

interface OnboardingContextValue {
  activeTourId: TourId | null;
  stepIndex: number;
  startTour: (tourId: TourId) => void;
  closeTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

// Mounted only once authenticated (see _layout.tsx), mirroring apps/web's OnboardingProvider --
// mounted here rather than at the root since there's nothing to onboard a user into pre-login.
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeTourId, setActiveTourId] = useState<TourId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void isTutorialCompleted().then((completed) => {
      if (cancelled || completed) return;
      setActiveTourId('global');
      setStepIndex(0);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const startTour = useCallback((tourId: TourId) => {
    setActiveTourId(tourId);
    setStepIndex(0);
  }, []);

  const closeTour = useCallback(() => {
    void markTutorialCompleted();
    setActiveTourId(null);
    setStepIndex(0);
  }, []);

  const nextStep = useCallback(() => {
    if (!activeTourId) return;
    const totalSteps = TOURS[activeTourId].steps.length;
    if (stepIndex + 1 >= totalSteps) {
      closeTour();
      return;
    }
    setStepIndex(stepIndex + 1);
  }, [activeTourId, stepIndex, closeTour]);

  const prevStep = useCallback(() => {
    setStepIndex((index) => Math.max(0, index - 1));
  }, []);

  const value = useMemo(
    () => ({ activeTourId, stepIndex, startTour, closeTour, nextStep, prevStep }),
    [activeTourId, stepIndex, startTour, closeTour, nextStep, prevStep],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      <OnboardingTutorial />
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
