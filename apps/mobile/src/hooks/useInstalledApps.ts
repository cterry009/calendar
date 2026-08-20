import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { getInstalledApps } from '../lib/blocklist/installedApps';
import type { InstalledAppInfo } from '../lib/blocklist/installedApps.types';

interface UseInstalledAppsResult {
  apps: InstalledAppInfo[];
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  isSupported: boolean;
  load: () => Promise<void>;
}

// Enumerating installed apps only makes sense on a real Android device (see
// lib/blocklist/installedApps.{native,web}.ts) and can be a few hundred entries, so this is
// load-on-demand (a button in the screen), not fetched automatically like every other mobile
// hook's refetch-on-mount.
export function useInstalledApps(): UseInstalledAppsResult {
  const [apps, setApps] = useState<InstalledAppInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getInstalledApps();
      setApps([...result].sort((a, b) => a.label.localeCompare(b.label)));
      setIsLoaded(true);
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : 'No se pudo leer la lista de apps instaladas.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { apps, isLoading, isLoaded, error, isSupported: Platform.OS === 'android', load };
}
