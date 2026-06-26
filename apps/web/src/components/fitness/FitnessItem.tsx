import { AppButton, AppCard, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { FITNESS_INTENSITY_LABELS } from '../../lib/fitness/labels';
import type { SyncFitnessRecord } from '../../lib/fitness/types';

interface FitnessItemProps {
  entry: SyncFitnessRecord;
  isBusy: boolean;
  onEdit: (entry: SyncFitnessRecord) => void;
  onDelete: (entry: SyncFitnessRecord) => Promise<void>;
}

interface MetaBadgeProps {
  text: string;
}

function MetaBadge({ text }: MetaBadgeProps) {
  return (
    <Text
      backgroundColor="rgba(255,255,255,0.08)"
      paddingHorizontal="$3"
      paddingVertical="$1"
      borderRadius="$10"
      fontSize="$2"
      color="$muted"
    >
      {text}
    </Text>
  );
}

export function FitnessItem({ entry, isBusy, onEdit, onDelete }: FitnessItemProps) {
  return (
    <AppCard>
      <YStack gap="$3">
        <XStack justifyContent="space-between" alignItems="flex-start" gap="$3" flexWrap="wrap">
          <YStack flex={1} minWidth={220}>
            <Paragraph size="$6" margin={0}>
              {entry.activityType}
            </Paragraph>
            {entry.notes ? (
              <Paragraph color="$muted" margin={0}>
                {entry.notes}
              </Paragraph>
            ) : null}
          </YStack>

          <XStack gap="$2" flexWrap="wrap">
            <MetaBadge text={`Duracion: ${entry.durationMinutes} min`} />
            <MetaBadge text={`Intensidad: ${FITNESS_INTENSITY_LABELS[entry.intensity]}`} />
            <MetaBadge text={`Origen: ${entry.source}`} />
          </XStack>
        </XStack>

        <XStack gap="$2" flexWrap="wrap">
          <MetaBadge text={`Registrado: ${new Date(entry.loggedAt).toLocaleString('es-ES')}`} />
        </XStack>

        <XStack gap="$2" justifyContent="flex-end" flexWrap="wrap">
          <AppButton type="button" variant="ghost" disabled={isBusy} onPress={() => onEdit(entry)}>
            Editar
          </AppButton>
          <AppButton type="button" variant="ghost" disabled={isBusy} onPress={() => void onDelete(entry)}>
            Eliminar
          </AppButton>
        </XStack>
      </YStack>
    </AppCard>
  );
}
