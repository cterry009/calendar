import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppButton, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { pickActivitySuggestion } from '@calendar/shared';
import { isDesktop } from '../../lib/desktop';
import { formatNightWindowMinutes, getNightSettings, nightWarningDue, setNightWindow } from '../../lib/desktop/nightWindow';
import { usePlan } from '../../hooks/usePlan';

// "Bloqueo nocturno en 30 min": the half hour before the night window, every 15 minutes, warn that
// social media and games are about to be blocked (the block itself is DesktopBlockingBridge adding
// the night targets once the window opens). Same timing as the phone's accessibility service.
//
// Unconditional on the PC, unlike the phone (which only warns while a social app or game is in
// front): the desktop only knows *today's* game/app time, not what's running this minute, and a PC
// that's on at 22:00 is being used.
const CHECK_INTERVAL_MS = 60_000;
const STORAGE_KEY = 'night-warning:last';

function readLast(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

function writeLast(ms: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(ms));
  } catch {
    // Worst case a warning repeats.
  }
}

async function raiseWindow() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const win = getCurrentWindow();
  await win.show();
  await win.unminimize();
  await win.setFocus();
}

export function DesktopNightWarnings() {
  // The window lives in the synced plan, the same as the phone's (2026-10-15).
  const { plan } = usePlan();
  useEffect(() => {
    const synced = plan?.nightWindow;
    if (!synced) return;
    const local = getNightSettings().window;
    if (local.startMinutes !== synced.startMinutes || local.endMinutes !== synced.endMinutes) setNightWindow(synced);
  }, [plan?.nightWindow?.startMinutes, plan?.nightWindow?.endMinutes]);

  const [active, setActive] = useState<{ minutesLeft: number; start: string; suggestion: string } | null>(null);

  useEffect(() => {
    if (!isDesktop) return;

    function check() {
      const settings = getNightSettings();
      const now = new Date();
      const minutesLeft = nightWarningDue(now, settings, readLast());
      if (minutesLeft === null) return;
      writeLast(now.getTime());

      const start = formatNightWindowMinutes(settings.window.startMinutes);
      setActive({ minutesLeft, start, suggestion: pickActivitySuggestion('GAME') });
      void raiseWindow().catch(() => undefined);
      void (async () => {
        try {
          const { isPermissionGranted, requestPermission, sendNotification } = await import(
            '@tauri-apps/plugin-notification'
          );
          if ((await isPermissionGranted()) || (await requestPermission()) === 'granted') {
            sendNotification({
              title: `Bloqueo nocturno en ${minutesLeft} min`,
              body: `A las ${start} se bloquean las redes sociales y los juegos hasta manana.`,
            });
          }
        } catch {
          // The overlay already did the loud part.
        }
      })();
    }

    check();
    const interval = window.setInterval(check, CHECK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  if (!isDesktop || !active || typeof document === 'undefined') return null;

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
        borderColor="$warning"
        borderRadius="$8"
        backgroundColor="rgba(33, 40, 54, 0.98)"
        padding="$6"
        gap="$4"
      >
        <Text fontWeight="800" fontSize="$7" color="$warning">
          Bloqueo nocturno en {active.minutesLeft} min
        </Text>
        <Paragraph margin={0} color="$muted">
          A las {active.start} se bloquean las redes sociales y los juegos hasta mañana. Buen momento para ir
          cerrando.
        </Paragraph>
        <YStack gap="$1" padding="$3" borderRadius="$4" backgroundColor="rgba(255,255,255,0.06)">
          <Text fontWeight="700" color="$accent">
            Mientras tanto
          </Text>
          <Paragraph margin={0}>{active.suggestion}</Paragraph>
        </YStack>
        <XStack justifyContent="flex-end">
          <AppButton variant="primary" onPress={() => setActive(null)}>
            Entendido
          </AppButton>
        </XStack>
      </YStack>
    </YStack>,
    document.body,
  );
}
