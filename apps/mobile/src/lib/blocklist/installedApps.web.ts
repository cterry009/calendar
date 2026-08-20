import type { InstalledAppInfo } from './installedApps.types';

// A browser has no OS-level concept of "installed apps" to enumerate -- this is the honest
// unsupported-platform stub (same pattern as expo-notifications' web scheduler stub in
// lib/notifications/api.ts), not a workaround. The screen that calls this checks
// Platform.OS === 'android' before calling it at all and shows an explanatory message instead;
// this throw is a backstop for anyone who calls it directly regardless.
export async function getInstalledApps(): Promise<InstalledAppInfo[]> {
  throw new Error('La lista de apps instaladas solo esta disponible en Android.');
}
