import { Outlet } from 'react-router-dom';
import { DesktopBlockedOverlay } from '../components/desktop/DesktopBlockedOverlay';
import { CheckInPrompt } from '../components/checkins/CheckInPrompt';
import { DesktopBlockingBridge } from '../components/desktop/DesktopBlockingBridge';
import { DesktopCommitmentBridge } from '../components/desktop/DesktopCommitmentBridge';
import { DesktopAppTimeBridge } from '../components/desktop/DesktopAppTimeBridge';
import { DesktopGameTimeBridge } from '../components/desktop/DesktopGameTimeBridge';
import { DesktopUsageWarnings } from '../components/desktop/DesktopUsageWarnings';
import { DesktopNightWarnings } from '../components/desktop/DesktopNightWarnings';
import { DesktopTrayBridge } from '../components/desktop/DesktopTrayBridge';
import { BlockFocusOverlay } from '../components/focus/BlockFocusOverlay';
import { FocusView } from '../components/focus/FocusView';
import { FlexibleBlockStarter } from '../components/morning/FlexibleBlockStarter';
import { MorningReminders } from '../components/morning/MorningReminders';
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
                  <DesktopTrayBridge />
                  <DesktopBlockingBridge />
                  <DesktopCommitmentBridge />
                  <DesktopGameTimeBridge />
                  <DesktopAppTimeBridge />
                  <DesktopUsageWarnings />
                  <DesktopNightWarnings />
                  <DesktopBlockedOverlay />
                  <CheckInPrompt />
                  <SyncStatusBanner />
                  <Outlet />
                  <PanelHost />
                  <SoftFocusOverlay />
                  <FocusView />
                  <BlockFocusOverlay />
                  <FlexibleBlockStarter />
                  <MorningReminders />
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
