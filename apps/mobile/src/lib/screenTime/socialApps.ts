// A curated list, not Android's own ApplicationInfo.category("social") signal -- that was tried
// first and rejected after real-device testing: `dumpsys package` showed both com.android.chrome
// (a browser) and com.whatsapp (messaging) resolving to CATEGORY_SOCIAL via an OS/Play-supplied
// "override" even though neither declares android:appCategory in its own manifest ("manifest: -1,
// override: 4" for both). Android's ApplicationInfo category enum has no separate "communication"
// bucket, so Play's install-time category hint apparently collapses that into SOCIAL -- a real,
// only-visible-on-hardware gap between what the field is documented to mean (self-declared) and
// what it actually contains, not something inspectable from source or web-preview testing. A
// hardcoded list is the more reliable choice here, if a smaller one.
//
// Deliberately scoped to classic feed/social-media apps, not messaging (WhatsApp, Telegram) --
// suggesting someone block their primary communication channel is a much bigger ask than
// suggesting they block a feed, and conflating the two would make this feature's suggestions feel
// wrong more often than right.
const KNOWN_SOCIAL_PACKAGES = new Set([
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
]);

export function isSocialApp(packageName: string): boolean {
  return KNOWN_SOCIAL_PACKAGES.has(packageName);
}
