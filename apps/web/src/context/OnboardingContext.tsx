import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);

  useEffect(() => {
    if (user && !isTutorialCompleted()) {
      setIsOpen(true);
    }
  }, [user]);

  useEffect(() => {
    if (pendingRoute && location.pathname === pendingRoute) {
      setPendingRoute(null);
    }
  }, [location.pathname, pendingRoute]);

  const openTutorial = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeTutorial = useCallback(() => {
    markTutorialCompleted();
    setIsOpen(false);
    setPendingRoute(null);
  }, []);

  const handleNavigate = useCallback(
    (route: string) => {
      setPendingRoute(route);
      navigate(route);
    },
    [navigate],
  );

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
      <OnboardingTutorial
        open={isOpen}
        currentPath={location.pathname}
        pendingRoute={pendingRoute}
        onNavigate={handleNavigate}
        onFinish={closeTutorial}
        onSkip={closeTutorial}
      />
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
