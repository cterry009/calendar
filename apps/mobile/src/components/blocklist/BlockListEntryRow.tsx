import { AppButton, Text, XStack, YStack } from '@calendar/ui';
import { confirmDestructiveAction } from '../../lib/confirmAction';
import { BLOCK_LIST_KIND_LABELS, BLOCK_LIST_PLATFORM_LABELS } from '../../lib/blocklist/labels';
import type { SyncBlockListRecord } from '../../lib/blocklist/types';

interface BlockListEntryRowProps {
  entry: SyncBlockListRecord;
  isBusy: boolean;
  isPending: boolean;
  onDelete: () => void;
}

// Mirrors apps/web/src/components/blocklist/BlockListItem.tsx, minus the edit form (this screen
// only creates entries via the installed-apps picker, see task 6.5's scope note in blocklist.tsx).
export function BlockListEntryRow({ entry, isBusy, isPending, onDelete }: BlockListEntryRowProps) {
  function confirmDelete() {
    // hardMode entries get a stronger message but the same single-confirm-dialog contract as a
    // normal entry -- design.md's "no single tap" requirement is about there being no bare X
    // button (this always routes through a confirm), not about needing two separate dialogs.
    const message = entry.hardMode
      ? `"${entry.label}" esta en modo estricto. Eliminarla anula la barrera que te pusiste a ti mismo. Continuar?`
      : `Eliminar "${entry.label}"? Esta accion no se puede deshacer.`;
    confirmDestructiveAction('Eliminar entrada', message, 'Eliminar', onDelete);
  }

  return (
    <YStack gap="$2" paddingVertical="$3" borderBottomWidth={1} borderBottomColor="$borderColor">
      <XStack alignItems="center" justifyContent="space-between" gap="$2">
        <YStack flex={1} gap="$1">
          <Text fontWeight="600" fontSize="$4">
            {entry.label}
          </Text>
          <Text color="$muted" fontSize="$2">
            {entry.identifier}
          </Text>
        </YStack>
        <AppButton variant="ghost" paddingHorizontal="$2" onPress={confirmDelete} disabled={isBusy}>
          <Text color="$danger" fontSize="$2">
            {isPending ? 'Quitando...' : 'Quitar'}
          </Text>
        </AppButton>
      </XStack>

      <XStack gap="$3" flexWrap="wrap">
        <Text fontSize="$2" color="$muted">
          {BLOCK_LIST_KIND_LABELS[entry.kind]}
        </Text>
        {entry.platform ? (
          <Text fontSize="$2" color="$muted">
            {BLOCK_LIST_PLATFORM_LABELS[entry.platform]}
          </Text>
        ) : null}
        {entry.hardMode ? (
          <Text fontSize="$2" color="$danger" fontWeight="700">
            Modo estricto
          </Text>
        ) : null}
        {!entry.enabled ? (
          <Text fontSize="$2" color="$muted">
            Inactivo
          </Text>
        ) : null}
      </XStack>
    </YStack>
  );
}
