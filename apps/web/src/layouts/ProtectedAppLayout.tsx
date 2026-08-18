import { Outlet } from 'react-router-dom';
import { SoftFocusOverlay } from '../components/focus/SoftFocusOverlay';
import { PanelHost } from '../components/panels/PanelHost';
import { GlobalQuickAdd } from '../components/tasks/GlobalQuickAdd';
import { SyncStatusBanner } from '../components/SyncStatusBanner';
import { OnboardingProvider } from '../context/OnboardingContext';
import { PanelProvider } from '../context/PanelContext';
import { PomodoroProvider } from '../context/PomodoroContext';
import { QuickAddProvider } from '../context/QuickAddContext';
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
                <QuickAddProvider>
                  <AppNav />
                  <SyncStatusBanner />
                  <Outlet />
                  <PanelHost />
                  <SoftFocusOverlay />
                  <GlobalQuickAdd />
                </QuickAddProvider>
              </PanelProvider>
            </SerotoninSessionProvider>
          </SoftFocusProvider>
        </PomodoroProvider>
      </OnboardingProvider>
    </SyncProvider>
  );
}
