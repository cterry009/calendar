import { useEffect, useRef } from 'react';
import {
  evaluateUsageWarnings,
  sumSocialMobileMinutes,
  usageWarningBody,
  usageWarningTitle,
  type UsageWarningCategory,
} from '@calendar/shared';
import { useScreenTime } from './useScreenTime';
import { sendLocalNotification } from '../lib/notifications/api';
import { platformStorage } from '../lib/platformStorage';

// "Llevas una hora en redes sociales" -- the Android half of the shared usage warnings, using the
// same threshold and the same curated social list as the desktop client
// (packages/shared/src/screenTime/usageWarnings.ts).
//
// Social only, no games: Android screen time gives package names with no category, and there is
// no game-detection module here like the desktop's game_tracking.rs. Inventing a curated list of
// game packages would be guesswork of the kind socialPackages.ts explicitly rejected, so games
// stay a desktop-only warning until there's a real signal to back them.
//
// Rides useScreenTime's existing reads rather than polling natively again.
//
// **Known limitation:** those reads only refresh while this app is in the foreground (see
// useScreenTimeSync's AppState listener), so on Android a warning lands the next time you open
// this app -- not the moment you cross a threshold. That was defensible when there was a single
// warning per day at the one-hour mark; it is a real gap now that the schedule escalates to every
// 5 minutes, because the escalation is exactly what you'd be missing while scrolling something
// else. Closing it properly needs a foreground service or a background task doing the
// UsageStatsManager read on its own, the way modules/focus-block's accessibility service already
// stays resident -- a separate piece of work, not something this hook can fix. The desktop client
// has no such gap: its webview keeps running in the tray.

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function storageKey(category: UsageWarningCategory): string {
  return `usage-warning:${todayKey()}:${category}`;
}

async function readLastWarned(category: UsageWarningCategory): Promise<number | null> {
  const raw = await platformStorage.getItem(storageKey(category));
  if (raw === null) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function useUsageWarnings(): void {
  const { isSupported, hasAccess, todayUsage } = useScreenTime();
  // Guards against two notifications racing out of overlapping effect runs before the async
  // storage write lands.
  const notifyingRef = useRef(false);

  useEffect(() => {
    if (!isSupported || !hasAccess || todayUsage.length === 0) return;
    if (notifyingRef.current) return;

    const socialMinutes = sumSocialMobileMinutes(
      todayUsage.map((entry) => ({
        packageName: entry.packageName,
        minutes: Math.floor(entry.totalTimeMs / 60_000),
      })),
    );

    notifyingRef.current = true;

    void (async () => {
      try {
        // Stored per category as the minute count of the last warning, not a flag: that's what
        // drives the 30 -> 15 -> 5 min escalation and stops a reopened app replaying the
        // intervals that elapsed while it wasn't running. The local date in the key resets it
        // overnight by itself.
        const lastWarned = {
          SOCIAL: await readLastWarned('SOCIAL'),
          GAMES: await readLastWarned('GAMES'),
        };

        const warnings = evaluateUsageWarnings({ socialMinutes, gameMinutes: 0 }, lastWarned);

        for (const warning of warnings) {
          await sendLocalNotification(
            usageWarningTitle(warning.category),
            usageWarningBody(warning),
          );
          await platformStorage.setItem(storageKey(warning.category), String(warning.minutes));
        }
      } catch {
        // No notification permission, or the web preview's stub scheduler. Not worth surfacing.
      } finally {
        notifyingRef.current = false;
      }
    })();
  }, [isSupported, hasAccess, todayUsage]);
}
