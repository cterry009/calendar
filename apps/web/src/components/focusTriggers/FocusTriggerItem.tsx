import { AppButton, AppCard, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import type { SyncFocusTriggerRecord } from '../../lib/focusTriggers/types';

const KIND_LABELS: Record<SyncFocusTriggerRecord['kind'], string> = {
  LOCATION: 'Ubicacion',
  WIFI: 'Red Wi-Fi',
};

interface FocusTriggerItemProps {
  trigger: SyncFocusTriggerRecord;
  isBusy: boolean;
  onEdit: (trigger: SyncFocusTriggerRecord) => void;
  onDelete: (trigger: SyncFocusTriggerRecord) => Promise<void>;
}

export function FocusTriggerItem({ trigger, isBusy, onEdit, onDelete }: FocusTriggerItemProps) {
  async function handleDelete() {
    if (!window.confirm(`Eliminar "${trigger.label}"? Esta accion no se puede deshacer.`)) {
      return;
    }
    await onDelete(trigger);
  }

  return (
    <AppCard>
      <YStack gap="$3">
        <XStack justifyContent="space-between" alignItems="flex-start" gap="$3" flexWrap="wrap">
          <YStack gap="$1" flex={1} minWidth={220}>
            <Paragraph margin={0} size="$6">
              {trigger.label}
            </Paragraph>
            <Paragraph margin={0} color="$muted">
              {trigger.kind === 'LOCATION'
                ? trigger.latitude != null && trigger.longitude != null
                  ? `${trigger.latitude.toFixed(5)}, ${trigger.longitude.toFixed(5)} - radio ${trigger.radiusMeters ?? '?'} m`
                  : 'Sin ubicacion definida'
                : (trigger.wifiSsid ?? 'Sin SSID definido')}
            </Paragraph>
          </YStack>

          <YStack gap="$1" alignItems="flex-end">
            <Text fontSize="$2" color="$muted">
              {KIND_LABELS[trigger.kind]}
            </Text>
          </YStack>
        </XStack>

        <XStack gap="$2" flexWrap="wrap">
          {trigger.kind === 'WIFI' ? (
            <Text fontSize="$2" color="$warning">
              Solo se activa desde apps nativas (Android/Windows)
            </Text>
          ) : null}
          <Text fontSize="$2" color="$muted">
            {trigger.enabled ? 'Activa' : 'Inactiva'}
          </Text>
        </XStack>

        <XStack gap="$2" justifyContent="flex-end" flexWrap="wrap">
          <AppButton type="button" variant="ghost" disabled={isBusy} onPress={() => onEdit(trigger)}>
            Editar
          </AppButton>
          <AppButton type="button" variant="danger" disabled={isBusy} onPress={() => void handleDelete()}>
            Eliminar
          </AppButton>
        </XStack>
      </YStack>
    </AppCard>
  );
}
