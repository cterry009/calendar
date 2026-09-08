import { useEffect, useState } from 'react';
import { AppButton, AppCard, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { isDesktop } from '../../lib/desktop';

// Task 9.6. Desktop parity of Android's /blocked screen (6.7): when the process blocker
// (blocking.rs, task 9.3) terminates an app during focus, a short dismissable card appears in the
// window. Website blocks are enforced at the DNS/hosts layer (9.4) and surface as the browser's
// own "can't reach this site" -- there's no app-side signal for those, so this covers the
// process-kill case. isDesktop-gated; renders nothing in a plain browser.

interface BlockedItem {
  id: number;
  name: string;
}

const DISMISS_MS = 7000;

export function DesktopBlockedOverlay() {
  const [items, setItems] = useState<BlockedItem[]>([]);

  useEffect(() => {
    if (!isDesktop) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    let seq = 0;

    void import('@tauri-apps/api/event').then(({ listen }) =>
      listen<string>('process-blocked', (event) => {
        const id = ++seq;
        const name = event.payload || 'una app';
        setItems((current) => [...current, { id, name }].slice(-3));
        window.setTimeout(() => {
          setItems((current) => current.filter((it) => it.id !== id));
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
      try {
        unlisten?.();
      } catch {
        /* listener already gone */
      }
    };
  }, []);

  if (!isDesktop || items.length === 0) return null;

  return (
    <YStack
      position="fixed"
      top={16}
      right={16}
      gap="$2"
      zIndex={100_000}
      maxWidth={360}
      pointerEvents="box-none"
    >
      {items.map((item) => (
        <AppCard key={item.id}>
          <YStack gap="$2">
            <Text fontWeight="800" color="$danger">
              App bloqueada
            </Text>
            <Paragraph margin={0} color="$muted">
              Se cerró <Text fontWeight="700">{item.name}</Text> porque tenés un enfoque activo
              (pomodoro, tarea u horario de trabajo).
            </Paragraph>
            <XStack justifyContent="flex-end">
              <AppButton
                variant="ghost"
                onPress={() => setItems((current) => current.filter((it) => it.id !== item.id))}
              >
                Volver al enfoque
              </AppButton>
            </XStack>
          </YStack>
        </AppCard>
      ))}
    </YStack>
  );
}
