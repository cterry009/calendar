import { AppButton, AppCard, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { BLOCK_LIST_KIND_LABELS, BLOCK_LIST_PLATFORM_LABELS } from '../../lib/blocklist/labels';
import type { SyncBlockListRecord } from '../../lib/blocklist/types';
import { NightStartEditor } from './NightStartEditor';

interface BlockListItemProps {
  entry: SyncBlockListRecord;
  isBusy: boolean;
  onEdit: (entry: SyncBlockListRecord) => void;
  onDelete: (entry: SyncBlockListRecord) => Promise<void>;
  onSaveNightStarts?: (entry: SyncBlockListRecord, weekday: number | null, weekend: number | null) => Promise<void>;
  isLocked?: boolean;
}

export function BlockListItem({ entry, isBusy, onEdit, onDelete, onSaveNightStarts, isLocked }: BlockListItemProps) {
  // The commitment refuses weakening a night entry; only its start can still move, earlier.
  const lockedNight = isLocked && entry.scope === 'NIGHT';

  async function handleDelete() {
    const message = entry.hardMode
      ? `"${entry.label}" esta en modo estricto. Eliminarla anula la barrera que te pusiste a ti mismo. Esta seguro?`
      : `Eliminar "${entry.label}"? Esta accion no se puede deshacer.`;
    if (!window.confirm(message)) {
      return;
    }
    await onDelete(entry);
  }

  return (
    <AppCard>
      <YStack gap="$3">
        <XStack justifyContent="space-between" alignItems="flex-start" gap="$3" flexWrap="wrap">
          <YStack gap="$1" flex={1} minWidth={220}>
            <Paragraph margin={0} size="$6">
              {entry.label}
            </Paragraph>
            <Paragraph margin={0} color="$muted">
              {entry.identifier}
            </Paragraph>
          </YStack>

          <YStack gap="$1" alignItems="flex-end">
            <Text fontSize="$2" color="$muted">
              {BLOCK_LIST_KIND_LABELS[entry.kind]}
            </Text>
            {entry.platform ? (
              <Text fontSize="$2" color="$muted">
                {BLOCK_LIST_PLATFORM_LABELS[entry.platform]}
              </Text>
            ) : null}
          </YStack>
        </XStack>

        <XStack gap="$2" flexWrap="wrap">
          {entry.highDopamine ? (
            <Text fontSize="$2" color="$muted">
              Alta dopamina
            </Text>
          ) : null}
          {entry.hardMode ? (
            <Text fontSize="$2" color="$error" fontWeight="700">
              Modo estricto
            </Text>
          ) : null}
          <Text fontSize="$2" color="$muted">
            {entry.enabled ? 'Activo' : 'Inactivo'}
          </Text>
        </XStack>

        {entry.scope === 'NIGHT' && onSaveNightStarts ? (
          <NightStartEditor
            entry={entry}
            isLocked={!!isLocked}
            isBusy={isBusy}
            onSave={(weekday, weekend) => onSaveNightStarts(entry, weekday, weekend)}
          />
        ) : null}

        {lockedNight ? null : (
          <XStack gap="$2" justifyContent="flex-end" flexWrap="wrap">
            <AppButton type="button" variant="ghost" disabled={isBusy} onPress={() => onEdit(entry)}>
              Editar
            </AppButton>
            <AppButton type="button" variant="danger" disabled={isBusy} onPress={() => void handleDelete()}>
              Eliminar
            </AppButton>
          </XStack>
        )}
      </YStack>
    </AppCard>
  );
}
