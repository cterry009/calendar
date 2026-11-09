import { H1, YStack } from '@calendar/ui';
import { ProyectosList } from '../components/agenda/ProyectosList';

export function ProyectosPage() {
  return (
    <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$6" gap="$4" maxWidth={1240} width="100%" alignSelf="center">
      <H1 margin={0} fontFamily="$heading" fontSize="$9" fontWeight="500">
        Proyectos
      </H1>
      <ProyectosList />
    </YStack>
  );
}
