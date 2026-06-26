import { useNavigate } from 'react-router-dom';
import { AppButton, Eyebrow, H1, Paragraph, XStack, YStack } from '@calendar/ui';
import { CalendarPanel } from '../components/calendar/CalendarPanel';

export function CalendarPage() {
  const navigate = useNavigate();

  return (
    <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$7" gap="$5">
      <XStack justifyContent="space-between" alignItems="flex-start" gap="$4" flexWrap="wrap">
        <YStack maxWidth={700}>
          <Eyebrow>Planificación</Eyebrow>
          <H1 marginTop={0} marginBottom="$2">
            Calendario de productividad
          </H1>
          <Paragraph color="$muted" margin={0}>
            Organiza tareas, bloques de trabajo, descansos y sesiones pomodoro en vistas día, semana y
            mes.
          </Paragraph>
        </YStack>

        <AppButton variant="ghost" onPress={() => navigate('/')}>
          Volver al inicio
        </AppButton>
      </XStack>

      <CalendarPanel />
    </YStack>
  );
}
