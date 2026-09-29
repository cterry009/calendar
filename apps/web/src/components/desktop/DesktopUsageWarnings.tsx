import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppButton, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import {
  WORK_HOURS_CLOSE_GRACE_MINUTES,
  classifyGameWarning,
  evaluateUsageWarnings,
  limitWarningBody,
  limitWarningTitle,
  nextWarningThreshold,
  shouldSuppressUsageWarnings,
  sumSocialDesktopMinutes,
  usageWarningBody,
  usageWarningTitle,
  warningIntervalMinutes,
  type GameWarningKind,
  type UsageWarning,
  type UsageWarningCategory,
} from '@calendar/shared';
import { useSoftFocus } from '../../context/SoftFocusContext';
import { isDesktop } from '../../lib/desktop';
import { getWorkGameLimit, markFinalWarningGiven, startCloseCountdown } from '../../lib/desktop/workGameLimit';
import type { DesktopAppTimeEntry } from '../../lib/desktopAppTime/sync';
import type { DesktopGameTimeEntry } from '../../lib/gameTime/sync';

// "Llevas una hora" -- escalating warnings for social and game time, on top of whatever you're
// doing. Two channels on purpose: a native notification (which survives being missed, and shows
// in the Action Center) plus a full-screen overlay with the window raised, because a corner toast
// is exactly what you ignore when you're deep in a game. Same reasoning DesktopBlockedOverlay
// already documents for using a centered popup over a corner card, and the same show/unminimize/
// set_focus move blocking.rs makes when it kills a blocked app.
//
// Two schedule rules on top of the escalation (both in packages/shared usageWarnings.ts):
//   - Inside a WORK block, game warnings turn strict: final warning, then a 5-minute countdown,
//     then DesktopBlockingBridge closes the game (via useWorkGameLock) until the block ends.
//   - Friday to Sunday evenings are silent, unless a WORK block says otherwise.
//
// Policy lives here rather than in Rust, like the rest of it -- Rust only observes. The webview
// keeps running while the window is hidden in the tray, so this fires even when the app is
// "closed", which is precisely when it's needed.
const POLL_INTERVAL_MS = 60_000;

interface ActiveWarning {
  warning: UsageWarning;
  kind: GameWarningKind;
  /** Only for kind CLOSE: epoch ms when the game gets closed. */
  deadline: number | null;
}

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

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function titleFor(active: ActiveWarning): string {
  return limitWarningTitle(active.warning.category, active.kind);
}

function bodyFor(warning: UsageWarning, kind: GameWarningKind): string {
  return limitWarningBody(warning.category, kind, warning.minutes);
}

export function DesktopUsageWarnings() {
  const { isWithinWorkSchedule } = useSoftFocus();
  const [active, setActive] = useState<ActiveWarning | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // The poll below is set up once; a ref lets it read the current work-hours state without
  // tearing the interval down every time SoftFocus re-renders.
  const inWorkHoursRef = useRef(isWithinWorkSchedule);
  inWorkHoursRef.current = isWithinWorkSchedule;

  const dismiss = useCallback(() => {
    setActive(null);
    void releaseAlwaysOnTop();
  }, []);

  // Live countdown for the closing warning.
  const deadline = active?.deadline ?? null;
  useEffect(() => {
    if (deadline === null) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [deadline]);

  // Once it hits zero the game is killed and DesktopBlockedOverlay takes over with its own popup;
  // leaving this one up would stack two overlays saying the same thing.
  useEffect(() => {
    if (deadline !== null && now >= deadline + 3000) dismiss();
  }, [deadline, now, dismiss]);

  useEffect(() => {
    if (!isDesktop) return;

    let cancelled = false;

    async function check() {
      try {
        const current = new Date();
        const inWorkHours = inWorkHoursRef.current;
        if (shouldSuppressUsageWarnings(current, inWorkHours)) return;

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

        const shown: ActiveWarning[] = [];
        for (const warning of due) {
          // Games and social media run the same strict sequence, each on its own state.
          const { category } = warning;
          const limit = getWorkGameLimit(category);
          // A countdown is already running (or ran out and the category is locked): the lock is
          // doing the talking now, and a new warning would only restart a clock that must not.
          if (inWorkHours && limit.closeDeadline !== null) continue;
          const kind = classifyGameWarning(warning.minutes, {
            inWorkHours,
            finalWarningGiven: limit.finalWarningGiven,
          });
          if (kind === 'FINAL') markFinalWarningGiven(category);
          const closeAt = kind === 'CLOSE' ? startCloseCountdown(category) : null;
          shown.push({ warning, kind, deadline: closeAt });
        }
        if (shown.length === 0) return;

        // Overlay first, and never behind an await on the notification channel. The overlay is
        // the half that actually interrupts you, so it must not be gated on permission checks
        // that can prompt, stall, or fail -- an earlier revision ordered these the other way and
        // a warning got recorded as delivered while nothing appeared on screen.
        //
        // A work-hours game warning always wins the overlay (it announces a consequence); after
        // that, the highest count wins, so the overlay shows the one that's actually worse.
        const worst = shown.reduce((a, b) => {
          if ((b.kind !== 'NORMAL') !== (a.kind !== 'NORMAL')) return b.kind !== 'NORMAL' ? b : a;
          return b.warning.minutes > a.warning.minutes ? b : a;
        });
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
            for (const item of shown) {
              sendNotification({ title: titleFor(item), body: bodyFor(item.warning, item.kind) });
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

  const { warning, kind } = active;
  const nextAt = nextWarningThreshold(warning.minutes);
  const isSocial = warning.category === 'SOCIAL';
  const remainingMs = active.deadline !== null ? active.deadline - now : 0;

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
          {titleFor(active)}
        </Text>
        <Paragraph margin={0} color="$muted">
          Llevas{' '}
          <Text fontWeight="700" color="$danger">
            {formatMinutes(warning.minutes)}
          </Text>{' '}
          hoy {isSocial ? 'en redes sociales' : 'jugando'}
          {kind === 'NORMAL' ? '.' : ' y estás en horario de trabajo.'}
        </Paragraph>

        {kind === 'CLOSE' ? (
          <YStack gap="$2" padding="$3" borderRadius="$4" backgroundColor="rgba(255,255,255,0.06)" alignItems="center">
            <Text fontWeight="800" fontSize="$9" color="$danger">
              {remainingMs > 0 ? formatCountdown(remainingMs) : 'Cerrando...'}
            </Text>
            <Paragraph margin={0} textAlign="center">
              {isSocial
                ? 'Cuando llegue a cero se cierran las redes sociales, y quedan bloqueadas hasta que termine tu horario de trabajo.'
                : 'Guarda la partida. Cuando llegue a cero se cierra el juego, y los juegos quedan bloqueados hasta que termine tu horario de trabajo.'}
            </Paragraph>
          </YStack>
        ) : (
          <YStack gap="$1" padding="$3" borderRadius="$4" backgroundColor="rgba(255,255,255,0.06)">
            <Text fontWeight="700" color="$accent">
              Si sigues
            </Text>
            <Paragraph margin={0}>
              {kind === 'FINAL' ? (
                <>
                  El próximo aviso, a los {formatMinutes(nextAt)},{' '}
                  <Text fontWeight="700">{isSocial ? 'cierra las redes sociales' : 'cierra el juego'}</Text>: tendrás{' '}
                  {WORK_HOURS_CLOSE_GRACE_MINUTES} minutos antes de que se cierre.
                </>
              ) : (
                <>
                  El proximo aviso llega a los {formatMinutes(nextAt)} (cada{' '}
                  {warningIntervalMinutes(warning.minutes)} min a este ritmo).
                </>
              )}
            </Paragraph>
          </YStack>
        )}

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
