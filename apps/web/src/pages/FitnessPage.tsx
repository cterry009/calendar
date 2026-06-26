import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppButton, AppCard, Eyebrow, H1, Paragraph, XStack, YStack } from '@calendar/ui';
import { FitnessForm } from '../components/fitness/FitnessForm';
import { FitnessList } from '../components/fitness/FitnessList';
import { WeeklyFitnessSummary } from '../components/fitness/WeeklyFitnessSummary';
import { useFitness } from '../hooks/useFitness';
import { buildDailySummary } from '../lib/fitness/summary';
import type { FitnessFormValues, SyncFitnessRecord } from '../lib/fitness/types';

export function FitnessPage() {
  const navigate = useNavigate();
  const { entries, isLoading, isMutating, error, syncedAt, refetch, createEntry, updateEntry, deleteEntry } =
    useFitness();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<SyncFitnessRecord | null>(null);

  async function handleCreate(values: FitnessFormValues) {
    await createEntry(values);
    setShowCreateForm(false);
  }

  async function handleUpdate(values: FitnessFormValues) {
    if (!editingEntry) return;
    await updateEntry(editingEntry.id, values);
    setEditingEntry(null);
  }

  async function handleDelete(entry: SyncFitnessRecord) {
    await deleteEntry(entry.id);
    if (editingEntry?.id === entry.id) {
      setEditingEntry(null);
    }
  }

  const dailySummary = useMemo(() => buildDailySummary(entries, new Date()), [entries]);

  return (
    <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$7" gap="$5">
      <XStack justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap="$4">
        <YStack maxWidth={760}>
          <Eyebrow>Bienestar</Eyebrow>
          <H1 marginTop={0} marginBottom="$2">
            Fitness manual
          </H1>
          <Paragraph color="$muted" margin={0}>
            Registra actividades de ejercicio y revisa resumentes diarios y semanales para seguir tu consistencia.
          </Paragraph>
        </YStack>

        <XStack gap="$2" flexWrap="wrap">
          <AppButton type="button" variant="ghost" onPress={() => navigate('/calendar')}>
            Calendario
          </AppButton>
          <AppButton type="button" variant="ghost" onPress={() => navigate('/tasks')}>
            Tareas
          </AppButton>
          <AppButton type="button" variant="ghost" onPress={() => navigate('/')}>
            Inicio
          </AppButton>
        </XStack>
      </XStack>

      <WeeklyFitnessSummary entries={entries} referenceDate={new Date()} />

      <AppCard>
        <YStack gap="$3">
          <Paragraph margin={0}>Resumen del dia</Paragraph>
          <Paragraph color="$muted" margin={0}>
            Hoy llevas {dailySummary.totalMinutes} minutos en {dailySummary.sessionCount} sesiones.
          </Paragraph>
          <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$2">
            <AppButton
              type="button"
              variant={showCreateForm ? 'ghost' : 'primary'}
              onPress={() => {
                setEditingEntry(null);
                setShowCreateForm((value) => !value);
              }}
            >
              {showCreateForm ? 'Cancelar nuevo registro' : 'Nuevo registro'}
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
        <FitnessForm
          mode="create"
          isSubmitting={isMutating}
          onSubmit={handleCreate}
          onCancel={() => setShowCreateForm(false)}
        />
      ) : null}

      {editingEntry ? (
        <FitnessForm
          mode="edit"
          initialEntry={editingEntry}
          isSubmitting={isMutating}
          onSubmit={handleUpdate}
          onCancel={() => setEditingEntry(null)}
        />
      ) : null}

      {isLoading ? (
        <AppCard>
          <Paragraph margin={0}>Cargando registros fitness...</Paragraph>
        </AppCard>
      ) : (
        <FitnessList
          entries={entries}
          isBusy={isMutating}
          emptyMessage="No hay registros fitness todavia."
          onEdit={(entry) => {
            setShowCreateForm(false);
            setEditingEntry(entry);
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
