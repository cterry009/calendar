import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppButton, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import {
  evaluateUsageWarnings,
  nextWarningThreshold,
  sumSocialDesktopMinutes,
  usageWarningBody,
  usageWarningTitle,
  warningIntervalMinutes,
  type UsageWarning,
  type UsageWarningCategory,
} from '@calendar/shared';
import { isDesktop } from '../../lib/desktop';
import type { DesktopAppTimeEntry } from '../../lib/desktopAppTime/sync';
import type { DesktopGameTimeEntry } from '../../lib/gameTime/sync';

// "Llevas una hora" -- escalating warnings for social and game time, on top of whatever you're
// doing. Two channels on purpose: a native notification (which survives being missed, and shows
// in the Action Center) plus a full-screen overlay with the window raised, because a corner toast
// is exactly what you ignore when you're deep in a game. Same reasoning DesktopBlockedOverlay
// already documents for using a centered popup over a corner card, and the same show/unminimize/
// set_focus move blocking.rs makes when it kills a blocked app.
//
// Policy lives here rather than in Rust, like the rest of it -- Rust only observes. The webview
// keeps running while the window is hidden in the tray, so this fires even when the app is
// "closed", which is precisely when it's needed.
const POLL_INTERVAL_MS = 60_000;

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function storageKey(category: UsageWarningCategory): string {
  return `usage-warning:${todayKey()}:${category}`;
}

// Stores the minute count at which we last warned, not a boolean: that's what drives the
// escalation (30 -> 15 -> 5 min) and what keeps a reopened app from replaying missed intervals.
// The local date in the key resets the whole thing overnight on its own.
function readLastWarned(category: UsageWarningCategory): number | null {
  try {
    const raw = localStorage.getItem(storageKey(category));
    if (raw === null) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeLastWarned(category: UsageWarningCategory, minutes: number): void {
  try {
    localStorage.setItem(storageKey(category), String(minutes));
  } catch {
    // Blocked storage: worst case a warning repeats, which beats crashing.
  }
}

async function raiseWindow(): Promise<void> {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const win = getCurrentWindow();
  await win.show();
  await win.unminimize();
  await win.setAlwaysOnTop(true);
  await win.setFocus();
}

async function releaseAlwaysOnTop(): Promise<void> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    // Only the always-on-top pin is temporary -- the window itself stays where the user left it.
    await getCurrentWindow().setAlwaysOnTop(false);
  } catch {
    // Not desktop / native side gone.
  }
}

function formatMinutes(value: number): string {
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function DesktopUsageWarnings() {
  const [active, setActive] = useState<UsageWarning | null>(null);

  const dismiss = useCallback(() => {
    setActive(null);
    void releaseAlwaysOnTop();
  }, []);

  useEffect(() => {
    if (!isDesktop) return;

    let cancelled = false;

    async function check() {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const [appEntries, gameEntries] = await Promise.all([
          invoke<DesktopAppTimeEntry[]>('get_app_time_today'),
          invoke<DesktopGameTimeEntry[]>('get_game_time_today'),
        ]);
        if (cancelled) return;

        const due = evaluateUsageWarnings(
          {
            socialMinutes: sumSocialDesktopMinutes(appEntries ?? []),
            gameMinutes: (gameEntries ?? []).reduce((total, entry) => total + entry.minutes, 0),
          },
          { SOCIAL: readLastWarned('SOCIAL'), GAMES: readLastWarned('GAMES') },
        );
        if (due.length === 0 || cancelled) return;

        for (const warning of due) {
          writeLastWarned(warning.category, warning.minutes);
        }

        // Overlay first, and never behind an await on the notification channel. The overlay is
        // the half that actually interrupts you, so it must not be gated on permission checks
        // that can prompt, stall, or fail -- an earlier revision ordered these the other way and
        // a warning got recorded as delivered while nothing appeared on screen.
        //
        // Highest count wins when both categories come due on the same tick, so the overlay shows
        // the one that's actually worse instead of whichever happened to be first.
        const worst = due.reduce((a, b) => (b.minutes > a.minutes ? b : a));
        setActive(worst);
        void raiseWindow().catch(() => {
          // Window controls unavailable; the overlay is still rendered.
        });

        void (async () => {
          try {
            const { isPermissionGranted, requestPermission, sendNotification } = await import(
              '@tauri-apps/plugin-notification'
            );
            const granted =
              (await isPermissionGranted()) || (await requestPermission()) === 'granted';
            if (!granted) return;
            for (const warning of due) {
              sendNotification({
                title: usageWarningTitle(warning.category),
                body: usageWarningBody(warning),
              });
            }
          } catch {
            // Notification channel unavailable -- the overlay already did the loud part.
          }
        })();
      } catch {
        // Native side not ready / not desktop.
      }
    }

    void check();
    const interval = window.setInterval(() => void check(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  if (!isDesktop || !active || typeof document === 'undefined') return null;

  const nextAt = nextWarningThreshold(active.minutes);
  const isSocial = active.category === 'SOCIAL';

  return createPortal(
    <YStack
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={100_001}
      backgroundColor="rgba(10, 12, 16, 0.82)"
      justifyContent="center"
      alignItems="center"
      padding="$6"
    >
      <YStack
        width="100%"
        maxWidth={480}
        borderWidth={2}
        borderColor="$danger"
        borderRadius="$8"
        backgroundColor="rgba(33, 40, 54, 0.98)"
        padding="$6"
        gap="$4"
      >
        <Text fontWeight="800" fontSize="$7" color="$danger">
          {usageWarningTitle(active.category)}
        </Text>
        <Paragraph margin={0} color="$muted">
          Llevas{' '}
          <Text fontWeight="700" color="$danger">
            {formatMinutes(active.minutes)}
          </Text>{' '}
          hoy {isSocial ? 'en redes sociales' : 'jugando'}.
        </Paragraph>
        <YStack gap="$1" padding="$3" borderRadius="$4" backgroundColor="rgba(255,255,255,0.06)">
          <Text fontWeight="700" color="$accent">
            Si sigues
          </Text>
          <Paragraph margin={0}>
            El proximo aviso llega a los {formatMinutes(nextAt)} (cada{' '}
            {warningIntervalMinutes(active.minutes)} min a este ritmo).
          </Paragraph>
        </YStack>
        <XStack justifyContent="flex-end">
          <AppButton variant="primary" onPress={dismiss}>
            Entendido
          </AppButton>
        </XStack>
      </YStack>
    </YStack>,
    document.body,
  );
}
