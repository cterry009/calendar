// Moved here from apps/mobile/src/lib/screenTime/distractingApps.ts (that file now re-exports
// from here) so the "redes sociales" dashboard subtotal in analytics/dashboard.ts -- shared by
// both web and mobile -- can use the exact same list the mobile "Sugerencias de bloqueo" panel
// (tasks 7.20/7.21) already uses to flag social apps, instead of two independent lists that could
// silently drift (the same failure mode task 8.1 already fixed once for buildDashboardMetrics).
//
// Not Android's own ApplicationInfo.category("social") signal -- that was tried first and
// rejected after real-device testing: `dumpsys package` showed both com.android.chrome (a
// browser) and com.whatsapp (messaging) resolving to CATEGORY_SOCIAL via an OS/Play-supplied
// "override" even though neither declares android:appCategory in its own manifest ("manifest: -1,
// override: 4" for both). Android's ApplicationInfo category enum has no separate "communication"
// bucket, so Play's install-time category hint apparently collapses that into SOCIAL -- a real,
// only-visible-on-hardware gap between what the field is documented to mean (self-declared) and
// what it actually contains. A hardcoded list is the more reliable choice here, if a smaller one.
//
// Scoped to classic feed/social-media apps plus YouTube (added on explicit request -- not social
// media in the strict sense, but the same kind of high-dopamine, hard-to-stop-scrolling app this
// list exists to flag). Deliberately still excludes messaging (WhatsApp, Telegram) -- suggesting
// someone block/count their primary communication channel is a much bigger ask than a feed, and
// conflating the two would make this feature feel wrong more often than right.
const KNOWN_DISTRACTING_PACKAGES = new Set([
  'com.instagram.android',
  'com.facebook.katana',
  'com.facebook.lite',
  'com.zhiliaoapp.musically', // TikTok
  'com.ss.android.ugc.trill', // TikTok (some regions)
  'com.twitter.android',
  'com.snapchat.android',
  'com.reddit.frontpage',
  'com.instagram.barcelona', // Threads
  'com.linkedin.android',
  'com.pinterest',
  'com.tumblr',
  'com.google.android.youtube',
]);

export function isKnownDistractingApp(packageName: string): boolean {
  return KNOWN_DISTRACTING_PACKAGES.has(packageName);
}

/** The list itself, for the Android work-hours social limit, which evaluates it natively. */
export function knownDistractingPackages(): string[] {
  return [...KNOWN_DISTRACTING_PACKAGES];
}

// The same social set as websites, for the desktop's hosts-file block during a work focus. The
// hosts writer adds the `www.` variant itself; mobile-web and alternate hosts are listed explicitly
// since a hosts file has no wildcards. YouTube included, matching the app list above.
export const SOCIAL_WEBSITE_DOMAINS: readonly string[] = [
  'instagram.com',
  'facebook.com',
  'm.facebook.com',
  'tiktok.com',
  'x.com',
  'twitter.com',
  'mobile.twitter.com',
  'reddit.com',
  'old.reddit.com',
  'threads.net',
  'threads.com',
  'snapchat.com',
  'linkedin.com',
  'pinterest.com',
  'tumblr.com',
  'youtube.com',
  'm.youtube.com',
];
