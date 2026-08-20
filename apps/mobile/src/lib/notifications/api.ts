import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Local notifications only -- both triggers here (a pomodoro phase finishing, a new suggestion
// appearing) are things the device already knows about on its own; neither needs a server to
// push anything. Real remote push (Expo push tokens, server-side sending, background delivery)
// would be a genuinely separate task, not a simplification of this one.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function getNotificationPermissionGranted(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

export async function requestNotificationPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

export async function sendLocalNotification(title: string, body: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null });
  } catch (error) {
    // expo-notifications' web implementation has no real scheduler backing it (its
    // NotificationScheduler module is a stub with no scheduleNotificationAsync method at all,
    // so this throws UnavailabilityError every time) -- a real, documented gap only verifiable
    // on native/Expo Go, not something to crash the app over on the web preview target.
    if (Platform.OS !== 'web') {
      throw error;
    }
  }
}
