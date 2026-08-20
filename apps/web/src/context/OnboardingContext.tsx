import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { OnboardingTutorial } from '../components/onboarding/OnboardingTutorial';
import { useAuth } from './AuthContext';
import { isTutorialCompleted, markTutorialCompleted } from '../lib/onboarding/storage';
import { TOURS, type TourId } from '../lib/onboarding/tours';

interface OnboardingContextValue {
  activeTourId: TourId | null;
  stepIndex: number;
  startTour: (tourId: TourId) => void;
  closeTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  // Kept for the plain "Tutorial" button, which always launches the global tour directly.
  openTutorial: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeTourId, setActiveTourId] = useState<TourId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (user && !isTutorialCompleted()) {
      setActiveTourId('global');
      setStepIndex(0);
    }
  }, [user]);

  const startTour = useCallback((tourId: TourId) => {
    setActiveTourId(tourId);
    setStepIndex(0);
  }, []);

  const closeTour = useCallback(() => {
    markTutorialCompleted();
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

  const openTutorial = useCallback(() => startTour('global'), [startTour]);

  const value = useMemo(
    () => ({ activeTourId, stepIndex, startTour, closeTour, nextStep, prevStep, openTutorial }),
    [activeTourId, stepIndex, startTour, closeTour, nextStep, prevStep, openTutorial],
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
