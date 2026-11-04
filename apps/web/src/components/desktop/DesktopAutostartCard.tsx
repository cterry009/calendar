import { useEffect, useState } from 'react';
import { AppButton, AppCard, H3, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { isDesktop } from '../../lib/desktop';
import { useCommitment } from '../../hooks/useCommitment';

// Task 9.8. Desktop-only "start on boot" toggle, backed by tauri-plugin-autostart
// (HKCU\...\Run on Windows). isDesktop-gated -- renders nothing in a plain browser.

export function DesktopAutostartCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const { isLocked } = useCommitment();

  useEffect(() => {
    if (!isDesktop) return;
    void import('@tauri-apps/plugin-autostart')
      .then(({ isEnabled }) => isEnabled())
      .then(setEnabled)
      .catch(() => setError(true));
  }, []);

  if (!isDesktop) return null;

  async function toggle(next: boolean) {
    // The commitment keeps it on (DesktopCommitmentBridge).
    if (!next && isLocked) return;
    setBusy(true);
    setError(false);
    try {
      const { enable, disable } = await import('@tauri-apps/plugin-autostart');
      if (next) await enable();
      else await disable();
      setEnabled(next);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppCard>
      <YStack gap="$3">
        <H3 margin={0} fontSize="$5">
          Iniciar con Windows
        </H3>
        <Paragraph margin={0} color="$muted">
          Abre Calendar Productivity automáticamente al encender la computadora, minimizado en la
          bandeja del sistema, para que el bloqueo de enfoque esté siempre disponible.
        </Paragraph>
        <XStack gap="$2" alignItems="center">
          <AppButton
            variant={enabled ? 'primary' : 'ghost'}
            disabled={busy || enabled === null}
            onPress={() => void toggle(true)}
          >
            Activado
          </AppButton>
          <AppButton
            variant={enabled === false ? 'primary' : 'ghost'}
            disabled={busy || enabled === null}
            onPress={() => void toggle(false)}
          >
            Desactivado
          </AppButton>
          {enabled === null && !error ? (
            <Text color="$muted" fontSize="$2">
              Cargando...
            </Text>
          ) : null}
        </XStack>
        {error ? (
          <Text color="$danger" fontSize="$2">
            No se pudo cambiar el inicio automático.
          </Text>
        ) : null}
      </YStack>
    </AppCard>
  );
}
