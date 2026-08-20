import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getNotificationPermissionGranted, requestNotificationPermission } from '../lib/notifications/api';

interface NotificationsContextValue {
  notificationsEnabled: boolean;
  toggleNotifications: (enabled: boolean) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    // Picks up a permission already granted in a previous session -- don't make the user
    // re-toggle every time they open the app.
    void getNotificationPermissionGranted().then(setNotificationsEnabled);
  }, []);

  const toggleNotifications = useCallback(async (enabled: boolean) => {
    if (!enabled) {
      setNotificationsEnabled(false);
      return;
    }

    const granted = await requestNotificationPermission();
    setNotificationsEnabled(granted);
  }, []);

  const value = useMemo<NotificationsContextValue>(
    () => ({ notificationsEnabled, toggleNotifications }),
    [notificationsEnabled, toggleNotifications],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }
  return context;
}
