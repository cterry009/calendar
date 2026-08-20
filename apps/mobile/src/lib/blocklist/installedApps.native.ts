import { InstalledApps } from 'react-native-launcher-kit';
import { Platform } from 'react-native';
import type { InstalledAppInfo } from './installedApps.types';

// Real Android device/emulator path -- react-native-launcher-kit's native module (Kotlin,
// PackageManager-backed) reads the device's actual installed-app list. Needs the
// QUERY_ALL_PACKAGES manifest permission (see plugins/withQueryAllPackagesPermission.js) and a
// custom dev client/prebuild, since this is real native code with no Expo Go support. iOS has no
// equivalent OS API (Apple doesn't expose an installed-apps list to third-party apps), so this
// throws there too, same as web -- see installedApps.web.ts.
export async function getInstalledApps(): Promise<InstalledAppInfo[]> {
  if (Platform.OS !== 'android') {
    throw new Error('La lista de apps instaladas solo esta disponible en Android.');
  }

  const apps = await InstalledApps.getSortedApps({ includeVersion: false, includeAccentColor: false });
  return apps.map((app) => ({ packageName: app.packageName, label: app.label, icon: app.icon ?? null }));
}
