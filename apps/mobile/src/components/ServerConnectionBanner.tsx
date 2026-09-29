import { Text, XStack, YStack } from '@calendar/ui';
import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSync } from '../context/SyncContext';
import { useServerConnection } from '../hooks/useServerConnection';
import { checkServer, displayHost, type ConnectionState } from '../lib/server/connection';

const DOT_COLORS: Record<ConnectionState, string> = {
  online: '#3ecf8e',
  checking: '#e0b84a',
  offline: '#e5484d',
};

export function ConnectionDot({ state }: { state: ConnectionState }) {
  return <YStack width={10} height={10} borderRadius={5} backgroundColor={DOT_COLORS[state]} />;
}

// Always-visible server status, replacing the old SyncStatusBanner (which only appeared after a
// failed request, and a request that hung never failed -- so it never appeared at all). Tapping
// it opens the Servidor screen. Mounted once at the root, which also makes it the connection
// monitor's single watcher.
export function ServerConnectionBanner() {
  const status = useServerConnection(true);
  const { pendingQueueCount } = useSync();
  // Sits above every screen, so it owns the status-bar inset (it was drawing under the clock).
  const { top } = useSafeAreaInsets();

  const host = status.url ? displayHost(status.url) : '';
  const queued = pendingQueueCount > 0 ? ` · ${pendingQueueCount} cambio(s) en cola` : '';

  if (status.state === 'offline') {
    return (
      <Pressable onPress={() => router.push('/server')}>
        <YStack backgroundColor="rgba(229, 72, 77, 0.18)" paddingHorizontal="$4" paddingBottom="$2" paddingTop={top + 8} gap="$1">
          <XStack gap="$2" alignItems="center">
            <ConnectionDot state="offline" />
            <Text fontSize="$3" fontWeight="700" color="$danger" flex={1}>
              Sin conexión con el servidor ({host})
            </Text>
          </XStack>
          <Text fontSize="$2" color="$muted">
            Mostrando datos guardados{queued}. Se reintenta cada 30 s.
          </Text>
          <XStack gap="$4">
            <Pressable onPress={() => void checkServer()} hitSlop={8}>
              <Text fontSize="$2" fontWeight="700" color="$accent">
                Reintentar
              </Text>
            </Pressable>
            <Pressable onPress={() => router.push('/server')} hitSlop={8}>
              <Text fontSize="$2" fontWeight="700" color="$accent">
                Cambiar servidor
              </Text>
            </Pressable>
          </XStack>
        </YStack>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={() => router.push('/server')}>
      <XStack paddingHorizontal="$4" paddingBottom="$1" paddingTop={top + 4} gap="$2" alignItems="center" justifyContent="center">
        <ConnectionDot state={status.state} />
        <Text fontSize="$2" color="$muted">
          {status.state === 'online' ? `Conectado a ${host}` : 'Comprobando conexión...'}
          {queued}
        </Text>
      </XStack>
    </Pressable>
  );
}
