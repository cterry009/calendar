import { useMemo, useState } from 'react';
import { AppButton, AppCard, Paragraph, XStack, YStack } from '@calendar/ui';
import { FitnessForm } from '../components/fitness/FitnessForm';
import { FitnessList } from '../components/fitness/FitnessList';
import { WeeklyFitnessSummary } from '../components/fitness/WeeklyFitnessSummary';
import { PageHeader } from '../components/PageHeader';
import { StatusCard } from '../components/StatusCard';
import { useFitness } from '../hooks/useFitness';
import { buildDailySummary } from '../lib/fitness/summary';
import type { FitnessFormValues, SyncFitnessRecord } from '../lib/fitness/types';

export function FitnessPage() {
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
      <PageHeader
        eyebrow="Bienestar"
        title="Fitness manual"
        description="Registra actividades de ejercicio y revisa resumentes diarios y semanales para seguir tu consistencia. Los descansos del calendario tambien permiten registrar fitness directamente."
      />

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

      {error ? <StatusCard tone="error" message={error} /> : null}

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
        <StatusCard tone="loading" message="Cargando registros fitness..." />
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
