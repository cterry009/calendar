import { isKnownDistractingApp } from './socialPackages.js';

// "Llevas una hora" warnings, shared by the Windows desktop client and Android so both use the
// same threshold and the same idea of what counts as social -- the same anti-drift reasoning
// socialPackages.ts gives for centralising its own list.
//
// Per category, not per app: twenty minutes in each of three feeds is the same lost hour as sixty
// in one, and only the category total catches that.
export const USAGE_WARNING_THRESHOLD_MINUTES = 60;

export type UsageWarningCategory = 'SOCIAL' | 'GAMES';

export interface UsageWarning {
  category: UsageWarningCategory;
  minutes: number;
}

export interface UsageCategoryTotals {
  socialMinutes: number;
  gameMinutes: number;
}

/** Minutes at which each category was last warned about today; absent = not warned yet. */
export type UsageWarningState = Partial<Record<UsageWarningCategory, number | null>>;

// The nagging gets tighter the longer it goes: one warning at the first hour, then every 30 min,
// every 15 min past the second hour, and every 5 min past the third. The interval is chosen from
// where you already are, so it escalates on its own without a schedule to keep in sync.
export function warningIntervalMinutes(minutes: number): number {
  if (minutes >= 180) return 5;
  if (minutes >= 120) return 15;
  return 30;
}

/** Minute count at which the next warning for a category is due. */
export function nextWarningThreshold(lastWarnedMinutes: number | null | undefined): number {
  if (lastWarnedMinutes == null) return USAGE_WARNING_THRESHOLD_MINUTES;
  return lastWarnedMinutes + warningIntervalMinutes(lastWarnedMinutes);
}

// Dedicated desktop social clients, keyed by lowercased exe name to match app_tracking.rs's keys.
//
// **This list is structurally incomplete on Windows and that is not fixable here.** Desktop social
// media overwhelmingly happens inside a browser tab, and the tracker reads only the process name,
// never the window title -- deliberately, since titles would leak document names and browsing into
// the sync pipeline. So chrome.exe is indistinguishable from chrome.exe. Only standalone clients
// can be attributed, which in practice means this fires rarely on desktop while the GAMES warning
// (backed by game_tracking.rs's registry/process detection) is reliable. Android has no such gap:
// there every app is its own package.
//
// Messaging is excluded on purpose, matching KNOWN_DISTRACTING_PACKAGES' reasoning -- warning
// someone about their primary communication channel would feel wrong more often than right.
const SOCIAL_DESKTOP_EXECUTABLES = new Set([
  'instagram.exe',
  'tiktok.exe',
  'twitter.exe',
  'x.exe',
  'facebook.exe',
  'reddit.exe',
  'pinterest.exe',
  'tumblr.exe',
]);

export function isSocialDesktopApp(exeName: string): boolean {
  return SOCIAL_DESKTOP_EXECUTABLES.has(exeName.toLowerCase());
}

export function sumSocialDesktopMinutes(entries: { key: string; minutes: number }[]): number {
  return entries.reduce(
    (total, entry) => (isSocialDesktopApp(entry.key) ? total + entry.minutes : total),
    0,
  );
}

export function sumSocialMobileMinutes(
  entries: { packageName: string; minutes: number }[],
): number {
  return entries.reduce(
    (total, entry) => (isKnownDistractingApp(entry.packageName) ? total + entry.minutes : total),
    0,
  );
}

// Returns the categories whose next warning is due. `lastWarned` comes from per-platform storage
// (it needs a day key), so reading and writing it stays with the caller and this stays pure.
//
// A caller that records `warning.minutes` -- not the threshold that was crossed -- gets catch-up
// suppression for free: coming back at 200 minutes after a long gap fires once at the current
// level instead of replaying every interval that elapsed while nothing was watching.
export function evaluateUsageWarnings(
  totals: UsageCategoryTotals,
  lastWarned: UsageWarningState = {},
): UsageWarning[] {
  const warnings: UsageWarning[] = [];

  if (totals.socialMinutes >= nextWarningThreshold(lastWarned.SOCIAL)) {
    warnings.push({ category: 'SOCIAL', minutes: totals.socialMinutes });
  }
  if (totals.gameMinutes >= nextWarningThreshold(lastWarned.GAMES)) {
    warnings.push({ category: 'GAMES', minutes: totals.gameMinutes });
  }

  return warnings;
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function usageWarningTitle(category: UsageWarningCategory): string {
  return category === 'SOCIAL' ? 'Una hora en redes sociales' : 'Una hora de juego';
}

export function usageWarningBody(warning: UsageWarning): string {
  const time = formatMinutes(warning.minutes);
  return warning.category === 'SOCIAL'
    ? `Llevas ${time} hoy en redes sociales. Buen momento para cortar.`
    : `Llevas ${time} hoy jugando. Buen momento para cortar.`;
}
