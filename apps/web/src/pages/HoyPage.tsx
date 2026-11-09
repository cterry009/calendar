import { YStack } from '@calendar/ui';
import { HoyDashboard } from '../components/agenda/HoySections';

export function HoyPage() {
  return (
    <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$6" gap="$4" maxWidth={1240} width="100%" alignSelf="center">
      <HoyDashboard />
    </YStack>
  );
}
