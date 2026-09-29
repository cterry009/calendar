import { AppButton, AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { Input } from 'tamagui';
import { ConnectionDot } from '../components/ServerConnectionBanner';
import { useServerConnection } from '../hooks/useServerConnection';
import {
  checkServer,
  displayHost,
  getApiUrl,
  getDefaultApiUrl,
  normalizeServerUrl,
  setServerUrl,
} from '../lib/server/connection';

// Reachable both logged in and out (see _layout.tsx), since a wrong server address is exactly
// what keeps you from logging in. Changing the address here takes effect immediately, no rebuild.
export default function ServerScreen() {
  const status = useServerConnection();
  const [input, setInput] = useState(() => displayHost(getApiUrl()));
  const [message, setMessage] = useState<{ tone: 'ok' | 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void checkServer();
  }, []);

  async function test() {
    const url = normalizeServerUrl(input);
    if (!url) {
      setMessage({ tone: 'error', text: 'Escribe una dirección válida, por ejemplo 192.168.80.26:3000.' });
      return;
    }
    setBusy(true);
    setMessage({ tone: 'info', text: `Probando ${displayHost(url)}...` });
    const ok = await checkServer(url);
    setBusy(false);
    setMessage(
      ok
        ? { tone: 'ok', text: `${displayHost(url)} responde.` }
        : { tone: 'error', text: `${displayHost(url)} no responde. Revisa que el PC esté prendido, en la misma red y con el servidor corriendo.` },
    );
  }

  async function save() {
    const url = normalizeServerUrl(input);
    if (!url) {
      setMessage({ tone: 'error', text: 'Escribe una dirección válida, por ejemplo 192.168.80.26:3000.' });
      return;
    }
    setBusy(true);
    await setServerUrl(url === getDefaultApiUrl() ? null : url);
    const ok = await checkServer();
    setBusy(false);
    setMessage(
      ok
        ? { tone: 'ok', text: 'Guardado. Conectado.' }
        : { tone: 'error', text: 'Guardado, pero todavía no responde. La app seguirá intentando sola.' },
    );
  }

  async function reset() {
    setInput(displayHost(getDefaultApiUrl()));
    setBusy(true);
    await setServerUrl(null);
    await checkServer();
    setBusy(false);
    setMessage({ tone: 'info', text: 'Dirección restablecida a la de fábrica.' });
  }

  const stateText =
    status.state === 'online' ? 'Conectado' : status.state === 'checking' ? 'Comprobando...' : 'Sin conexión';

  return (
    <YStack flex={1} backgroundColor="$background">
      <Stack.Screen
        options={{
          title: 'Servidor',
          headerShown: true,
          headerStyle: { backgroundColor: '#212e28' },
          headerTintColor: '#f2f7f4',
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
        <AppCard>
          <YStack gap="$2">
            <XStack gap="$2" alignItems="center">
              <ConnectionDot state={status.state} />
              <H2 margin={0} fontSize="$5">
                {stateText}
              </H2>
            </XStack>
            <Paragraph margin={0} color="$muted">
              Servidor actual: <Text fontWeight="700">{displayHost(getApiUrl())}</Text>
            </Paragraph>
            {status.state === 'offline' && status.error ? (
              <Paragraph margin={0} color="$danger">
                {status.error}
              </Paragraph>
            ) : null}
            {status.lastCheckedAt ? (
              <Text color="$muted" fontSize="$2">
                Última comprobación: {new Date(status.lastCheckedAt).toLocaleTimeString()}
              </Text>
            ) : null}
            <AppButton variant="ghost" onPress={() => void checkServer()} disabled={busy}>
              Reintentar ahora
            </AppButton>
          </YStack>
        </AppCard>

        <AppCard>
          <YStack gap="$2">
            <H2 margin={0} fontSize="$5">
              Cambiar dirección
            </H2>
            <Paragraph margin={0} color="$muted">
              La IP del PC en tu red (o su dirección de Tailscale) y el puerto, por ejemplo 192.168.80.26:3000. Si
              el PC cambió de IP, ponla aquí; no hace falta reinstalar la app.
            </Paragraph>
            <Input
              value={input}
              onChangeText={setInput}
              placeholder="192.168.80.26:3000"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <XStack gap="$2" flexWrap="wrap">
              <AppButton variant="ghost" onPress={() => void test()} disabled={busy}>
                Probar
              </AppButton>
              <AppButton variant="primary" onPress={() => void save()} disabled={busy}>
                Guardar
              </AppButton>
              <AppButton variant="ghost" onPress={() => void reset()} disabled={busy}>
                Restablecer
              </AppButton>
            </XStack>
            {message ? (
              <Text fontSize="$3" color={message.tone === 'error' ? '$danger' : message.tone === 'ok' ? '$accent' : '$muted'}>
                {message.text}
              </Text>
            ) : null}
            <Text color="$muted" fontSize="$2">
              De fábrica: {displayHost(getDefaultApiUrl())}
            </Text>
          </YStack>
        </AppCard>
      </ScrollView>
    </YStack>
  );
}
