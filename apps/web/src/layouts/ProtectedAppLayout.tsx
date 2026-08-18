import { Outlet } from 'react-router-dom';
import { SoftFocusOverlay } from '../components/focus/SoftFocusOverlay';
import { PanelHost } from '../components/panels/PanelHost';
import { SyncStatusBanner } from '../components/SyncStatusBanner';
import { OnboardingProvider } from '../context/OnboardingContext';
import { PanelProvider } from '../context/PanelContext';
import { PomodoroProvider } from '../context/PomodoroContext';
import { SerotoninSessionProvider } from '../context/SerotoninSessionContext';
import { SoftFocusProvider } from '../context/SoftFocusContext';
import { SyncProvider } from '../context/SyncContext';
import { AppNav } from './AppNav';

export function ProtectedAppLayout() {
  return (
    <SyncProvider>
      <OnboardingProvider>
        <PomodoroProvider>
          <SoftFocusProvider>
            <SerotoninSessionProvider>
              <PanelProvider>
                <AppNav />
                <SyncStatusBanner />
                <Outlet />
                <PanelHost />
                <SoftFocusOverlay />
              </PanelProvider>
            </SerotoninSessionProvider>
          </SoftFocusProvider>
        </PomodoroProvider>
      </OnboardingProvider>
    </SyncProvider>
  );
}
