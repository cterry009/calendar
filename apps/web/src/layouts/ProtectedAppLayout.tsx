import { Outlet } from 'react-router-dom';
import { SoftFocusOverlay } from '../components/focus/SoftFocusOverlay';
import { SyncStatusBanner } from '../components/SyncStatusBanner';
import { OnboardingProvider } from '../context/OnboardingContext';
import { PomodoroProvider } from '../context/PomodoroContext';
import { SoftFocusProvider } from '../context/SoftFocusContext';
import { SyncProvider } from '../context/SyncContext';
import { AppNav } from './AppNav';

export function ProtectedAppLayout() {
  return (
    <SyncProvider>
      <OnboardingProvider>
        <PomodoroProvider>
          <SoftFocusProvider>
            <AppNav />
            <SyncStatusBanner />
            <Outlet />
            <SoftFocusOverlay />
          </SoftFocusProvider>
        </PomodoroProvider>
      </OnboardingProvider>
    </SyncProvider>
  );
}
