// "Las que más usas" (user-requested, 2026-10-06): the apps and websites someone actually spends
// time on, on the phone and the PC, offered for the block list with one tap -- not only the
// curated social/game list (socialPackages.ts). Shared by apps/mobile and apps/web so both rank,
// filter and name things the same way.

export interface UsageItem {
  /** Exactly what a block-list entry stores: package name, exe name or domain. */
  identifier: string;
  label: string;
  minutes: number;
}

/**
 * Never offered: blocking these breaks the device (launcher, settings, phone, keyboard) or the
 * app itself. The accessibility service allowlists most of them anyway (isFocusAllowlisted).
 */
const NEVER_SUGGEST = new Set([
  // Android
  'app.calendarproductivity.mobile',
  'com.android.systemui',
  'com.android.settings',
  'com.android.phone',
  'com.android.incallui',
  'com.samsung.android.dialer',
  'com.google.android.dialer',
  'com.sec.android.app.launcher',
  'com.google.android.apps.nexuslauncher',
  'com.qqlabs.minimalistlauncher',
  'com.samsung.android.honeyboard',
  'com.google.android.inputmethod.latin',
  'com.google.android.permissioncontroller',
  'com.android.permissioncontroller',
  // Windows
  'explorer.exe',
  'calendar-desktop.exe',
  'calendar productivity.exe',
  'searchhost.exe',
  'startmenuexperiencehost.exe',
  'shellexperiencehost.exe',
  'lockapp.exe',
  'applicationframehost.exe',
  'systemsettings.exe',
  'taskmgr.exe',
  'msedgewebview2.exe',
]);

/** Most used first, without what's already blocked or must never be, at most `limit`. */
export function rankUsageSuggestions(items: UsageItem[], alreadyBlocked: Iterable<string>, limit = 8): UsageItem[] {
  const blocked = new Set([...alreadyBlocked].map((id) => id.toLowerCase()));
  const merged = new Map<string, UsageItem>();
  for (const item of items) {
    const key = item.identifier.toLowerCase();
    if (!key || NEVER_SUGGEST.has(key) || blocked.has(key) || item.minutes < 1) continue;
    const seen = merged.get(key);
    merged.set(key, seen ? { ...seen, minutes: seen.minutes + item.minutes } : { ...item });
  }
  return [...merged.values()].sort((a, b) => b.minutes - a.minutes).slice(0, limit);
}

/**
 * "https://www.YouTube.com/feed" or "youtube.com" -> "youtube.com"; null when it isn't a domain.
 * Same rules as the desktop's hosts.rs and the phone's WebsiteUsage.kt.
 */
export function normalizeWebsiteDomain(input: string): string | null {
  let rest = input.trim().toLowerCase();
  if (!rest || /\s/.test(rest)) return null;
  const scheme = rest.indexOf('://');
  if (scheme >= 0) rest = rest.slice(scheme + 3);
  let host = rest.split(/[/?#]/)[0] ?? '';
  host = host.slice(host.lastIndexOf('@') + 1).split(':')[0] ?? '';
  host = host.replace(/^www\./, '');
  if (!host.includes('.') || host.startsWith('.') || host.endsWith('.')) return null;
  if (!/^[a-z0-9.-]+$/.test(host)) return null;
  return host;
}

/** Whether `domain` is the blocked `entry` or one of its subdomains. */
export function websiteMatches(domain: string, entry: string): boolean {
  const e = normalizeWebsiteDomain(entry);
  return !!e && (domain === e || domain.endsWith(`.${e}`));
}

/** youtube.com -> "YouTube" style label for a new block-list entry: the first label, capitalized. */
export function websiteLabel(domain: string): string {
  const parts = domain.split('.');
  // mail.google.com -> "Mail Google"; youtube.com -> "Youtube"
  const meaningful = parts.length > 2 ? parts.slice(0, -1) : parts.slice(0, 1);
  return meaningful.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}
