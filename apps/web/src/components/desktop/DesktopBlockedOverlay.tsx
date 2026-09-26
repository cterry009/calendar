import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppButton, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { pickActivitySuggestion } from '@calendar/shared';
import { isDesktop } from '../../lib/desktop';

// Task 9.6. Desktop parity of Android's /blocked screen (6.7): when the process blocker
// (blocking.rs, task 9.3) terminates an app during focus, a dismissable alert appears. Website
// blocks are enforced at the DNS/hosts layer (9.4) and surface as the browser's own "can't reach
// this site" -- there's no app-side signal for those, so this covers the process-kill case.
// isDesktop-gated; renders nothing in a plain browser.
//
// User-requested, two changes from the original small corner toast: (1) a full-screen centered
// popup instead, since a corner card is easy to miss -- same visual weight as SoftFocusOverlay,
// rendered above it (higher z-index) so it's the thing actually seen; (2) blocking.rs itself now
// also brings the window to the foreground when it kills something (same reasoning as Android's
// fullScreenIntent block notification), so this popup is guaranteed to actually be on screen, not
// just correctly rendered behind another window. (3) A concrete alternative activity instead of
// just saying "no" -- every process-blocked event here is inherently a DESKTOP_APP block, and
// desktop app-blocking in this project is predominantly game-time tracking (9.9/9.10), so this
// always uses the GAME suggestion bucket (packages/shared/src/blocking/activitySuggestions.ts),
// the same bucket categorizeBlockedEntry('DESKTOP_APP', ...) would resolve to.

interface BlockedAlert {
  id: number;
  name: string;
  suggestion: string;
}

const DISMISS_MS = 10_000;

export function DesktopBlockedOverlay() {
  const [alert, setAlert] = useState<BlockedAlert | null>(null);

  useEffect(() => {
    if (!isDesktop) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    let seq = 0;
    let timeoutId: number | undefined;

    void import('@tauri-apps/api/event').then(({ listen }) =>
      listen<string>('process-blocked', (event) => {
        const id = ++seq;
        const name = event.payload || 'una app';
        const suggestion = pickActivitySuggestion('GAME');
        window.clearTimeout(timeoutId);
        setAlert({ id, name, suggestion });
        timeoutId = window.setTimeout(() => {
          setAlert((current) => (current?.id === id ? null : current));
        }, DISMISS_MS);
      }).then((fn) => {
        if (cancelled) {
          try {
            fn();
          } catch {
            /* listener already gone */
          }
        } else {
          unlisten = fn;
        }
      }),
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      try {
        unlisten?.();
      } catch {
        /* listener already gone */
      }
    };
  }, []);

  if (!isDesktop || !alert || typeof document === 'undefined') return null;

  return createPortal(
    <YStack
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={100_000}
      backgroundColor="rgba(10, 12, 16, 0.75)"
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
          App bloqueada
        </Text>
        <Paragraph margin={0} color="$muted">
          Se cerró <Text fontWeight="700">{alert.name}</Text> porque tenés un enfoque activo
          (pomodoro, tarea u horario de trabajo).
        </Paragraph>
        <YStack gap="$1" padding="$3" borderRadius="$4" backgroundColor="rgba(255,255,255,0.06)">
          <Text fontWeight="700" color="$accent">
            Mientras tanto
          </Text>
          <Paragraph margin={0}>{alert.suggestion}</Paragraph>
        </YStack>
        <XStack justifyContent="flex-end">
          <AppButton variant="primary" onPress={() => setAlert(null)}>
            Volver al enfoque
          </AppButton>
        </XStack>
      </YStack>
    </YStack>,
    document.body,
  );
}
