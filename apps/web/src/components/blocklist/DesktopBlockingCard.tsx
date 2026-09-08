import { useEffect, useState } from 'react';
import { AppButton, AppCard, H2, Paragraph, Text, YStack } from '@calendar/ui';
import { isDesktop } from '../../lib/desktop';

// Task 9.5. Shown only inside the Tauri desktop shell (apps/desktop). Explains what the desktop
// client enforces at the OS level and surfaces the one-time hosts-file permission grant that
// website blocking needs (task 9.4) -- the desktop parity of mobile's "Bloqueo real" card.

type GrantState = 'idle' | 'needed' | 'granting' | 'granted' | 'failed';

export function DesktopBlockingCard() {
  const [grant, setGrant] = useState<GrantState>('idle');

  useEffect(() => {
    if (!isDesktop) return;
    const onNeeded = () => setGrant((s) => (s === 'granted' ? s : 'needed'));
    window.addEventListener('desktop:hosts-permission-needed', onNeeded);
    return () => window.removeEventListener('desktop:hosts-permission-needed', onNeeded);
  }, []);

  if (!isDesktop) return null;

  async function requestAccess() {
    setGrant('granting');
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('request_hosts_access');
      setGrant('granted');
    } catch {
      setGrant('failed');
    }
  }

  return (
    <AppCard>
      <YStack gap="$3">
        <H2 margin={0} fontSize="$5">
          Bloqueo real en Windows
        </H2>
        <Paragraph margin={0} color="$muted">
          Durante un pomodoro, un bloque de trabajo o el modo serotonina, esta app cierra los
          programas de escritorio de la lista (tipo «App de escritorio», identificador =
          ejecutable, p. ej. <Text fontWeight="700">chrome.exe</Text>) y redirige los sitios de la
          lista (tipo «Sitio web») a una dirección muerta mediante el archivo <Text fontWeight="700">hosts</Text>.
        </Paragraph>

        {grant === 'needed' || grant === 'failed' ? (
          <YStack gap="$2" paddingTop="$2" borderTopWidth={1} borderTopColor="$borderColor">
            <Paragraph margin={0} color="$muted">
              El bloqueo de sitios necesita permiso para editar el archivo <Text fontWeight="700">hosts</Text>
              (protegido por Windows). Se pide <Text fontWeight="700">una sola vez</Text>: aparecerá el
              cuadro de Control de cuentas de usuario y a partir de ahí funciona sin volver a
              preguntar.
            </Paragraph>
            {grant === 'failed' ? (
              <Text color="$danger" fontSize="$2">
                No se concedió el permiso. Volvé a intentarlo cuando quieras activar el bloqueo de sitios.
              </Text>
            ) : null}
            <AppButton variant="primary" onPress={() => void requestAccess()}>
              Conceder acceso al archivo hosts
            </AppButton>
          </YStack>
        ) : null}

        {grant === 'granting' ? (
          <Text color="$muted" fontSize="$2">
            Esperando la confirmación de Windows...
          </Text>
        ) : null}

        {grant === 'granted' ? (
          <Text color="$accent" fontSize="$2" fontWeight="700">
            Acceso concedido. El bloqueo de sitios ya funciona.
          </Text>
        ) : null}
      </YStack>
    </AppCard>
  );
}
