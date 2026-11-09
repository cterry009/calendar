import type { SyncBatchResponse, SyncEntityType } from './types';

const ENTITY_LABELS: Record<SyncEntityType, string> = {
  tasks: 'tareas',
  schedules: 'horarios',
  pomodoroSessions: 'pomodoros',
  blockListEntries: 'lista de bloqueo',
  focusTriggers: 'condiciones de activacion',
  fitnessEntries: 'fitness',
  detoxPlan: 'plan detox',
  serotoninSession: 'bienestar diario',
  habits: 'habitos',
  habitRecords: 'registros de habitos',
  scheduleCompletions: 'bloques hechos',
  scheduleExceptions: 'cambios de un día en el horario',
  studyPlan: 'plan de estudio',
  journalEntries: 'notas de habitos',
  dailyGameTime: 'tiempo de juego',
  dailyDesktopAppTime: 'tiempo por aplicacion',
  focusEvents: 'registro de foco',
  exerciseAttempts: 'intentos de ejercicios',
  projects: 'proyectos',
};

export function countSyncConflicts(response: SyncBatchResponse): number {
  return Object.values(response.conflicts ?? {}).reduce(
    (total, items) => total + (items?.length ?? 0),
    0,
  );
}

export function formatSyncConflictMessage(response: SyncBatchResponse): string | null {
  // weekend-mode: refused on purpose, not because the server is newer.
  const reasons = Object.values(response.conflicts ?? {}).flatMap((items) =>
    (items ?? []).map((item) => (item as { reason?: string } | null)?.reason),
  );
  if (reasons.includes('commitment')) {
    return 'El compromiso de bloqueo no permite ese cambio: el bloqueo nocturno solo se puede reforzar mientras dure.';
  }
  if (reasons.includes('weekend-activity-cap')) {
    return 'Ese día ya tiene 3 actividades de fin de semana: es el máximo.';
  }

  const parts = Object.entries(response.conflicts ?? {})
    .filter(([, items]) => items && items.length > 0)
    .map(([entity, items]) => `${items!.length} en ${ENTITY_LABELS[entity as SyncEntityType]}`);

  if (!parts.length) {
    return null;
  }

  return `Conflicto de sincronizacion: el servidor tiene una version mas reciente (${parts.join(', ')}). Se muestran los datos del servidor.`;
}
