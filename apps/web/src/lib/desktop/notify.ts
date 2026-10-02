import { isDesktop } from './index';

/**
 * A system notification: Tauri's on the desktop, the browser's in a tab that has permission.
 * Best-effort -- callers show the same thing in the app, so a denied permission loses nothing vital.
 */
export async function notifySystem(title: string, body: string): Promise<void> {
  try {
    if (isDesktop) {
      const { isPermissionGranted, requestPermission, sendNotification } = await import('@tauri-apps/plugin-notification');
      if ((await isPermissionGranted()) || (await requestPermission()) === 'granted') sendNotification({ title, body });
    } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  } catch {
    // No notification support here; nothing else to do.
  }
}
