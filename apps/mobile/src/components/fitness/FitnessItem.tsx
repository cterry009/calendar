import { AppButton, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { confirmDestructiveAction } from '../../lib/confirmAction';
import { FITNESS_INTENSITY_LABELS, type SyncFitnessRecord } from '../../lib/fitness/types';

interface FitnessItemProps {
  entry: SyncFitnessRecord;
  isBusy: boolean;
  onDelete: () => void;
}

function formatLoggedAt(loggedAt: string): string {
  return new Date(loggedAt).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function FitnessItem({ entry, isBusy, onDelete }: FitnessItemProps) {
  function confirmDelete() {
    confirmDestructiveAction('Eliminar registro', `¿Eliminar "${entry.activityType}"?`, 'Eliminar', onDelete);
  }

  return (
    <YStack gap="$2" paddingVertical="$3" borderBottomWidth={1} borderBottomColor="$borderColor">
      <XStack alignItems="center" justifyContent="space-between" gap="$2">
        <Text fontWeight="600" fontSize="$4">
          {entry.activityType}
        </Text>
        <AppButton variant="ghost" paddingHorizontal="$2" onPress={confirmDelete} disabled={isBusy}>
          <Text color="$danger" fontSize="$2">
            Eliminar
          </Text>
        </AppButton>
      </XStack>

      {entry.notes ? (
        <Paragraph margin={0} color="$muted" fontSize="$2">
          {entry.notes}
        </Paragraph>
      ) : null}

      <Text color="$muted" fontSize="$2">
        {entry.durationMinutes} min · Intensidad {FITNESS_INTENSITY_LABELS[entry.intensity]} · {formatLoggedAt(entry.loggedAt)}
      </Text>
    </YStack>
  );
}
