import { Outlet } from 'react-router-dom';
import { SoftFocusOverlay } from '../components/focus/SoftFocusOverlay';
import { PomodoroProvider } from '../context/PomodoroContext';
import { SoftFocusProvider } from '../context/SoftFocusContext';

export function ProtectedAppLayout() {
  return (
    <PomodoroProvider>
      <SoftFocusProvider>
        <Outlet />
        <SoftFocusOverlay />
      </SoftFocusProvider>
    </PomodoroProvider>
  );
}
