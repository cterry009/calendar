import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppButton, AppCard, Eyebrow, H1, Paragraph, XStack, YStack } from '@calendar/ui';
import { BlockListForm } from '../components/blocklist/BlockListForm';
import { BlockListList } from '../components/blocklist/BlockListList';
import { useBlockList } from '../hooks/useBlockList';
import type { SyncBlockListRecord } from '../lib/blocklist/types';

export function BlockListPage() {
  const navigate = useNavigate();
  const {
    entries,
    isLoading,
    isMutating,
    error,
    syncedAt,
    refetch,
    createEntry,
    updateEntry,
    deleteEntry,
  } = useBlockList();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<SyncBlockListRecord | null>(null);

  return (
    <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$7" gap="$5">
      <XStack justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap="$4">
        <YStack maxWidth={760} data-tutorial="blocklist-header">
          <Eyebrow>Enfoque</Eyebrow>
          <H1 marginTop={0} marginBottom="$2">
            Lista de distracciones
          </H1>
          <Paragraph color="$muted" margin={0}>
            Gestiona apps, sitios y programas de escritorio que quieres bloquear durante pomodoros, tareas de foco o
            modo serotonina. Los clientes nativos aplican estas reglas en el sistema operativo.
          </Paragraph>
        </YStack>

        <XStack gap="$2" flexWrap="wrap">
          <AppButton type="button" variant="ghost" onPress={() => navigate('/pomodoro')}>
            Pomodoro
          </AppButton>
          <AppButton type="button" variant="ghost" onPress={() => navigate('/')}>
            Inicio
          </AppButton>
        </XStack>
      </XStack>

      <AppCard>
        <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$2">
          <AppButton
            type="button"
            variant={showCreateForm ? 'ghost' : 'primary'}
            onPress={() => {
              setEditingEntry(null);
              setShowCreateForm((value) => !value);
            }}
          >
            {showCreateForm ? 'Cancelar nueva entrada' : 'Nueva entrada'}
          </AppButton>

          <AppButton type="button" variant="ghost" onPress={() => void refetch()} disabled={isLoading || isMutating}>
            {isLoading ? 'Actualizando...' : 'Refrescar'}
          </AppButton>
        </XStack>
      </AppCard>

      {error ? (
        <AppCard>
          <Paragraph color="$error" margin={0}>
            {error}
          </Paragraph>
        </AppCard>
      ) : null}

      {showCreateForm ? (
        <BlockListForm
          mode="create"
          isSubmitting={isMutating}
          onSubmit={async (values) => {
            await createEntry(values);
            setShowCreateForm(false);
          }}
          onCancel={() => setShowCreateForm(false)}
        />
      ) : null}

      {editingEntry ? (
        <BlockListForm
          mode="edit"
          initialEntry={editingEntry}
          isSubmitting={isMutating}
          onSubmit={async (values) => {
            await updateEntry(editingEntry.id, values);
            setEditingEntry(null);
          }}
          onCancel={() => setEditingEntry(null)}
        />
      ) : null}

      {isLoading ? (
        <AppCard>
          <Paragraph margin={0}>Cargando lista de bloqueo...</Paragraph>
        </AppCard>
      ) : (
        <BlockListList
          entries={entries}
          isBusy={isMutating}
          emptyMessage="No hay entradas en la lista de bloqueo."
          onEdit={(entry) => {
            setShowCreateForm(false);
            setEditingEntry(entry);
          }}
          onDelete={(entry) => deleteEntry(entry.id)}
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
