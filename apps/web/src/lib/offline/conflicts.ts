import type { SyncBatchResponse, SyncEntityType } from './types';

const ENTITY_LABELS: Record<SyncEntityType, string> = {
  tasks: 'tareas',
  schedules: 'horarios',
  pomodoroSessions: 'pomodoros',
  blockListEntries: 'lista de bloqueo',
  fitnessEntries: 'fitness',
  detoxPlan: 'plan detox',
};

export function countSyncConflicts(response: SyncBatchResponse): number {
  return Object.values(response.conflicts ?? {}).reduce(
    (total, items) => total + (items?.length ?? 0),
    0,
  );
}

export function formatSyncConflictMessage(response: SyncBatchResponse): string | null {
  const parts = Object.entries(response.conflicts ?? {})
    .filter(([, items]) => items && items.length > 0)
    .map(([entity, items]) => `${items!.length} en ${ENTITY_LABELS[entity as SyncEntityType]}`);

  if (!parts.length) {
    return null;
  }

  return `Conflicto de sincronizacion: el servidor tiene una version mas reciente (${parts.join(', ')}). Se muestran los datos del servidor.`;
}
