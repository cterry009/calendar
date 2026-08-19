import { useState } from 'react';
import { AppButton, AppCard, H2, Paragraph, XStack, YStack } from '@calendar/ui';
import { BlockListForm } from '../components/blocklist/BlockListForm';
import { BlockListList } from '../components/blocklist/BlockListList';
import { FocusTriggerForm } from '../components/focusTriggers/FocusTriggerForm';
import { FocusTriggerList } from '../components/focusTriggers/FocusTriggerList';
import { PageHeader } from '../components/PageHeader';
import { StatusCard } from '../components/StatusCard';
import { useBlockList } from '../hooks/useBlockList';
import { useFocusTriggers } from '../hooks/useFocusTriggers';
import type { SyncBlockListRecord } from '../lib/blocklist/types';
import type { SyncFocusTriggerRecord } from '../lib/focusTriggers/types';

export function BlockListPage() {
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

  const {
    triggers,
    isLoading: isLoadingTriggers,
    isMutating: isMutatingTriggers,
    error: triggersError,
    createTrigger,
    updateTrigger,
    deleteTrigger,
  } = useFocusTriggers();

  const [showCreateTrigger, setShowCreateTrigger] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<SyncFocusTriggerRecord | null>(null);

  return (
    <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$7" gap="$5">
      <PageHeader
        eyebrow="Enfoque"
        title="Lista de distracciones"
        description="Gestiona apps, sitios y programas de escritorio que quieres bloquear durante pomodoros, bloques de trabajo del calendario o modo serotonina. Los clientes nativos aplican estas reglas en el sistema operativo."
        tutorialId="blocklist-header"
      />

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

      {error ? <StatusCard tone="error" message={error} /> : null}

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
        <StatusCard tone="loading" message="Cargando lista de bloqueo..." />
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

      <YStack gap="$3" marginTop="$4">
        <H2 margin={0} fontSize="$6">
          Condiciones de activacion
        </H2>
        <Paragraph margin={0} color="$muted">
          Ademas de un pomodoro, una tarea o un horario de trabajo activo, el bloqueo tambien puede activarse por
          ubicacion o red Wi-Fi. La ubicacion se evalua en el navegador en tiempo real; la Wi-Fi queda guardada como
          especificacion para las apps nativas de Android y Windows, que son las unicas que pueden leer la red
          conectada.
        </Paragraph>

        <AppCard>
          <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$2">
            <AppButton
              type="button"
              variant={showCreateTrigger ? 'ghost' : 'primary'}
              onPress={() => {
                setEditingTrigger(null);
                setShowCreateTrigger((value) => !value);
              }}
            >
              {showCreateTrigger ? 'Cancelar nueva condicion' : 'Nueva condicion'}
            </AppButton>
          </XStack>
        </AppCard>

        {triggersError ? <StatusCard tone="error" message={triggersError} /> : null}

        {showCreateTrigger ? (
          <FocusTriggerForm
            mode="create"
            isSubmitting={isMutatingTriggers}
            onSubmit={async (values) => {
              await createTrigger(values);
              setShowCreateTrigger(false);
            }}
            onCancel={() => setShowCreateTrigger(false)}
          />
        ) : null}

        {editingTrigger ? (
          <FocusTriggerForm
            mode="edit"
            initialTrigger={editingTrigger}
            isSubmitting={isMutatingTriggers}
            onSubmit={async (values) => {
              await updateTrigger(editingTrigger.id, values);
              setEditingTrigger(null);
            }}
            onCancel={() => setEditingTrigger(null)}
          />
        ) : null}

        {isLoadingTriggers ? (
          <StatusCard tone="loading" message="Cargando condiciones de activacion..." />
        ) : (
          <FocusTriggerList
            triggers={triggers}
            isBusy={isMutatingTriggers}
            emptyMessage="No hay condiciones de activacion configuradas."
            onEdit={(trigger) => {
              setShowCreateTrigger(false);
              setEditingTrigger(trigger);
            }}
            onDelete={(trigger) => deleteTrigger(trigger.id)}
          />
        )}
      </YStack>

      {syncedAt ? (
        <Paragraph size="$2" color="$muted" margin={0}>
          Ultima sincronizacion: {new Date(syncedAt).toLocaleString('es-ES')}
        </Paragraph>
      ) : null}
    </YStack>
  );
}
