import { useEffect } from 'react';
import { useSync } from '../context/SyncContext';
import type { SyncEntityType } from '../lib/offline/types';

export function useSyncRefetch(entity: SyncEntityType, refetch: () => Promise<void>) {
  const { registerEntityRefetch } = useSync();

  useEffect(() => {
    return registerEntityRefetch(entity, refetch);
  }, [entity, refetch, registerEntityRefetch]);
}

export function useSyncStatusMessage(): string | null {
  const { isOnline, pendingQueueCount, lastPullFromCache } = useSync();

  if (!isOnline) {
    return pendingQueueCount > 0
      ? `Sin conexion. ${pendingQueueCount} cambio(s) en cola local.`
      : 'Sin conexion. Mostrando datos guardados localmente.';
  }

  if (pendingQueueCount > 0) {
    return `${pendingQueueCount} cambio(s) pendientes de sincronizar.`;
  }

  if (lastPullFromCache) {
    return 'No se pudo contactar el servidor. Mostrando ultima copia local.';
  }

  return null;
}
