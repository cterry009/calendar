import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
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
    // re-toggle every time they open the app. Without it nothing shows at all, block prompts
    // included (found 2026-10-05: on a fresh install it was only ever asked from the pomodoro
    // screen's toggle), so ask on the first launch; Android stops showing the dialog by itself
    // once the user has said no twice.
    void (async () => {
      const granted = Platform.OS === 'android' ? await requestNotificationPermission() : await getNotificationPermissionGranted();
      setNotificationsEnabled(granted);
    })().catch(() => undefined);
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
