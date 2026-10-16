import { isKnownDistractingApp } from './socialPackages.js';

// The phone's home screen shows today's time in three buckets (user-requested, 2026-10-15): games,
// social media and series/streaming, each opening the apps behind it. Social is the same list the
// blocking uses (socialPackages.ts, YouTube included), and a game is what Android files as one --
// the rule FocusBlockAccessibilityService blocks games by -- so the numbers match what gets blocked.
// Streaming is display-only: no blocking rule uses it.

export const USAGE_CATEGORIES = ['GAMES', 'SOCIAL', 'STREAMING'] as const;
export type UsageCategory = (typeof USAGE_CATEGORIES)[number];

export const USAGE_CATEGORY_LABELS: Record<UsageCategory, string> = {
  GAMES: 'Juegos',
  SOCIAL: 'Redes sociales',
  STREAMING: 'Series y streaming',
};

const STREAMING_PACKAGES = new Set([
  'com.netflix.mediaclient',
  'com.disney.disneyplus',
  'com.disney.starplus', // Star+
  'com.amazon.avod.thirdpartyclient', // Prime Video
  'com.hbo.hbonow', // HBO Max (old)
  'com.wbd.stream', // Max
  'com.crunchyroll.crunchyroid',
  'com.cbs.app', // Paramount+
  'com.apple.atve.android.appletv',
  'com.plexapp.android',
  'tv.pluto.android',
  'com.univision.prendetv', // ViX
  'tv.twitch.android.app',
  'com.mubi',
  'com.google.android.videos', // Google TV
  'com.spotify.music', // podcasts/videos: not series, but the same "background screen" use
]);

export function isStreamingApp(packageName: string): boolean {
  return STREAMING_PACKAGES.has(packageName);
}

export interface CategorizableUsage {
  packageName: string;
  totalTimeMs: number;
  isGame?: boolean;
}

/** Which bucket an app's time goes to, or null for everything else. Social wins over game. */
export function usageCategoryOf(record: Pick<CategorizableUsage, 'packageName' | 'isGame'>): UsageCategory | null {
  if (isKnownDistractingApp(record.packageName)) return 'SOCIAL';
  if (isStreamingApp(record.packageName)) return 'STREAMING';
  if (record.isGame) return 'GAMES';
  return null;
}

export interface UsageCategorySummary<T extends CategorizableUsage> {
  totalMs: number;
  /** Most used first. */
  apps: T[];
}

export function summarizeUsageByCategory<T extends CategorizableUsage>(
  records: T[],
): Record<UsageCategory, UsageCategorySummary<T>> {
  const result = {
    GAMES: { totalMs: 0, apps: [] as T[] },
    SOCIAL: { totalMs: 0, apps: [] as T[] },
    STREAMING: { totalMs: 0, apps: [] as T[] },
  };
  for (const record of records) {
    const category = usageCategoryOf(record);
    if (!category || record.totalTimeMs <= 0) continue;
    result[category].totalMs += record.totalTimeMs;
    result[category].apps.push(record);
  }
  for (const category of USAGE_CATEGORIES) result[category].apps.sort((a, b) => b.totalTimeMs - a.totalTimeMs);
  return result;
}

/** "2 h 05 min", "45 min", "0 min". */
export function formatUsageDuration(totalMs: number): string {
  const totalMinutes = Math.round(totalMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${String(minutes).padStart(2, '0')} min`;
}
