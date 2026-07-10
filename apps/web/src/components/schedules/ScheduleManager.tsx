import { useState } from 'react';
import { AppButton, AppCard, H2, Paragraph, XStack, YStack } from '@calendar/ui';
import { ScheduleForm } from './ScheduleForm';
import { ScheduleList } from './ScheduleList';
import { useSchedules } from '../../hooks/useSchedules';
import type { ScheduleFormValues, SyncScheduleRecord } from '../../lib/schedules/types';

export function ScheduleManager() {
  const { schedules, isLoading, isMutating, error, syncedAt, refetch, createSchedule, updateSchedule, deleteSchedule } =
    useSchedules();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<SyncScheduleRecord | null>(null);

  async function handleCreate(values: ScheduleFormValues) {
    await createSchedule(values);
    setShowCreateForm(false);
  }

  async function handleUpdate(values: ScheduleFormValues) {
    if (!editingSchedule) return;
    await updateSchedule(editingSchedule.id, values);
    setEditingSchedule(null);
  }

  async function handleDelete(schedule: SyncScheduleRecord) {
    await deleteSchedule(schedule.id);
    if (editingSchedule?.id === schedule.id) {
      setEditingSchedule(null);
    }
  }

  return (
    <AppCard>
      <YStack gap="$4">
        <YStack gap="$1">
          <H2 margin={0} fontSize="$6">
            Horarios de trabajo y descanso
          </H2>
          <Paragraph color="$muted" margin={0}>
            Define bloques recurrentes por dia de la semana. Estos horarios son la base del calendario: los bloques
            de trabajo activan el bloqueo de distracciones y el plan de pomodoros; los de descanso permiten
            registrar fitness.
          </Paragraph>
        </YStack>

        <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$2">
          <AppButton
            type="button"
            variant={showCreateForm ? 'ghost' : 'primary'}
            onPress={() => {
              setEditingSchedule(null);
              setShowCreateForm((value) => !value);
            }}
          >
            {showCreateForm ? 'Cancelar nuevo horario' : 'Nuevo horario'}
          </AppButton>

          <AppButton type="button" variant="ghost" onPress={() => void refetch()} disabled={isLoading || isMutating}>
            {isLoading ? 'Actualizando...' : 'Refrescar'}
          </AppButton>
        </XStack>

        {error ? (
          <Paragraph color="$error" margin={0}>
            {error}
          </Paragraph>
        ) : null}

        {showCreateForm ? (
          <ScheduleForm mode="create" isSubmitting={isMutating} onSubmit={handleCreate} onCancel={() => setShowCreateForm(false)} />
        ) : null}

        {editingSchedule ? (
          <ScheduleForm
            mode="edit"
            initialSchedule={editingSchedule}
            isSubmitting={isMutating}
            onSubmit={handleUpdate}
            onCancel={() => setEditingSchedule(null)}
          />
        ) : null}

        {isLoading ? (
          <Paragraph margin={0}>Cargando horarios...</Paragraph>
        ) : (
          <ScheduleList
            schedules={schedules}
            isBusy={isMutating}
            emptyMessage="No hay horarios configurados todavia."
            onEdit={(schedule) => {
              setShowCreateForm(false);
              setEditingSchedule(schedule);
            }}
            onDelete={handleDelete}
          />
        )}

        {syncedAt ? (
          <Paragraph size="$2" color="$muted" margin={0}>
            Ultima sincronizacion: {new Date(syncedAt).toLocaleString('es-ES')}
          </Paragraph>
        ) : null}
      </YStack>
    </AppCard>
  );
}
