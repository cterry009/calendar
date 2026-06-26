import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppButton, AppCard, Eyebrow, H1, Paragraph, XStack, YStack } from '@calendar/ui';
import { ScheduleForm } from '../components/schedules/ScheduleForm';
import { ScheduleList } from '../components/schedules/ScheduleList';
import { useSchedules } from '../hooks/useSchedules';
import type { SyncScheduleRecord } from '../lib/schedules/types';

export function SchedulePage() {
  const navigate = useNavigate();
  const {
    schedules,
    isLoading,
    isMutating,
    error,
    syncedAt,
    refetch,
    createSchedule,
    updateSchedule,
    deleteSchedule,
  } = useSchedules();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<SyncScheduleRecord | null>(null);

  async function handleCreate(values: Parameters<typeof createSchedule>[0]) {
    await createSchedule(values);
    setShowCreateForm(false);
  }

  async function handleUpdate(values: Parameters<typeof updateSchedule>[1]) {
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
    <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$7" gap="$5">
      <XStack justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap="$4">
        <YStack maxWidth={760}>
          <Eyebrow>Configuracion</Eyebrow>
          <H1 marginTop={0} marginBottom="$2">
            Horarios de trabajo y descanso
          </H1>
          <Paragraph color="$muted" margin={0}>
            Define bloques recurrentes por dia de la semana para planificar jornadas, pausas y ventanas de
            recuperacion.
          </Paragraph>
        </YStack>

        <XStack gap="$2" flexWrap="wrap">
          <AppButton type="button" variant="ghost" onPress={() => navigate('/calendar')}>
            Calendario
          </AppButton>
          <AppButton type="button" variant="ghost" onPress={() => navigate('/')}>
            Inicio
          </AppButton>
        </XStack>
      </XStack>

      <AppCard>
        <YStack gap="$3">
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
        </YStack>
      </AppCard>

      {error ? (
        <AppCard>
          <Paragraph color="$error" margin={0}>
            {error}
          </Paragraph>
        </AppCard>
      ) : null}

      {showCreateForm ? (
        <ScheduleForm
          mode="create"
          isSubmitting={isMutating}
          onSubmit={handleCreate}
          onCancel={() => setShowCreateForm(false)}
        />
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
        <AppCard>
          <Paragraph margin={0}>Cargando horarios...</Paragraph>
        </AppCard>
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
  );
}
