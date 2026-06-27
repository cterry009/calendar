import { AppButton, AppCard, Paragraph, XStack, YStack } from '@calendar/ui';
import { useSync } from '../context/SyncContext';
import { useSyncStatusMessage } from '../hooks/useSyncRefetch';

export function SyncStatusBanner() {
  const message = useSyncStatusMessage();
  const { conflictMessage, clearConflictMessage } = useSync();

  if (!message && !conflictMessage) {
    return null;
  }

  return (
    <YStack gap="$2" marginHorizontal="$7" marginTop="$4" marginBottom={0}>
      {message ? (
        <AppCard>
          <Paragraph margin={0} color="$muted">
            {message}
          </Paragraph>
        </AppCard>
      ) : null}

      {conflictMessage ? (
        <AppCard backgroundColor="rgba(255, 120, 80, 0.12)">
          <XStack justifyContent="space-between" alignItems="center" gap="$3" flexWrap="wrap">
            <Paragraph margin={0} color="$error">
              {conflictMessage}
            </Paragraph>
            <AppButton type="button" variant="ghost" onPress={clearConflictMessage}>
              Entendido
            </AppButton>
          </XStack>
        </AppCard>
      ) : null}
    </YStack>
  );
}
