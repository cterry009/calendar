import { AppCard, Paragraph } from '@calendar/ui';
import { useSyncStatusMessage } from '../hooks/useSyncRefetch';

export function SyncStatusBanner() {
  const message = useSyncStatusMessage();

  if (!message) {
    return null;
  }

  return (
    <AppCard marginHorizontal="$7" marginTop="$4" marginBottom={0}>
      <Paragraph margin={0} color="$muted">
        {message}
      </Paragraph>
    </AppCard>
  );
}
