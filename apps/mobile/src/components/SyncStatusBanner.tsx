import { Text, XStack } from '@calendar/ui';
import { useSync } from '../context/SyncContext';

// Mirrors apps/web/src/components/SyncStatusBanner.tsx's state precedence exactly.
export function SyncStatusBanner() {
  const { isOnline, pendingQueueCount, lastPullFromCache } = useSync();

  let message: string | null = null;

  if (!isOnline && pendingQueueCount > 0) {
    message = `Sin conexion. ${pendingQueueCount} cambio(s) en cola local.`;
  } else if (!isOnline) {
    message = 'Sin conexion. Mostrando datos guardados localmente.';
  } else if (pendingQueueCount > 0) {
    message = `${pendingQueueCount} cambio(s) pendientes de sincronizar.`;
  } else if (lastPullFromCache) {
    message = 'No se pudo contactar el servidor. Mostrando ultima copia local.';
  }

  if (!message) {
    return null;
  }

  return (
    <XStack backgroundColor="$overlayMedium" paddingHorizontal="$4" paddingVertical="$2" justifyContent="center">
      <Text fontSize="$2" color="$muted">
        {message}
      </Text>
    </XStack>
  );
}
