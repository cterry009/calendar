import { AppButton, Text, XStack } from '@calendar/ui';
import type { InstalledAppInfo } from '../../lib/blocklist/installedApps.types';

interface InstalledAppRowProps {
  app: InstalledAppInfo;
  isBlocked: boolean;
  isBusy: boolean;
  onToggle: () => void;
}

export function InstalledAppRow({ app, isBlocked, isBusy, onToggle }: InstalledAppRowProps) {
  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      gap="$2"
      paddingVertical="$3"
      borderBottomWidth={1}
      borderBottomColor="$borderColor"
    >
      <XStack flex={1} gap="$1" flexDirection="column">
        <Text fontWeight="600" fontSize="$4">
          {app.label}
        </Text>
        <Text color="$muted" fontSize="$2">
          {app.packageName}
        </Text>
      </XStack>
      <AppButton variant={isBlocked ? 'danger' : 'ghost'} paddingHorizontal="$3" onPress={onToggle} disabled={isBusy}>
        {isBlocked ? 'Quitar' : 'Bloquear'}
      </AppButton>
    </XStack>
  );
}
