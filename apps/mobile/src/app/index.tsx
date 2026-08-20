import { completedPomodoroDateKeys, computePomodoroStreak } from '@calendar/shared';
import { AppButton, AppCard, Eyebrow, H1, Paragraph, Text, YStack } from '@calendar/ui';
import { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

/**
 * Scaffold home screen (tasks 6.1 + first slice of 6.2): confirms @calendar/ui (Tamagui design
 * system), @calendar/shared (pure domain logic), and now real auth (login/register/logout
 * against the NestJS server) all work on native, not just web. Calendar/tasks/pomodoro/fitness
 * screens are the rest of 6.2, not done here yet.
 */
export default function HomeScreen() {
  const { user, logout } = useAuth();

  // Trivial use of shared business logic with an empty history, just to prove the
  // pure @calendar/shared package (no DOM/browser globals) runs unmodified on native.
  const streak = useMemo(() => computePomodoroStreak(completedPomodoroDateKeys([])), []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#212e28' }}>
      <YStack flex={1} padding="$6" gap="$5" justifyContent="center">
        <YStack gap="$1">
          <Eyebrow>Calendar Productivity</Eyebrow>
          <H1 marginTop={0} marginBottom={0}>
            Hola{user?.name ? `, ${user.name}` : ''}
          </H1>
          <Paragraph color="$muted" margin={0}>
            Sesion iniciada como {user?.email}. El calendario, las tareas y el pomodoro se portan
            en el resto de la tarea 6.2.
          </Paragraph>
        </YStack>

        <AppCard>
          <YStack gap="$3">
            <Text fontWeight="700">Racha de pomodoros (logica compartida)</Text>
            <Paragraph margin={0} color="$muted">
              {streak.currentStreak} dias seguidos -- calculado con el mismo
              computePomodoroStreak() de packages/shared que usa la web.
            </Paragraph>
          </YStack>
        </AppCard>

        <AppButton variant="ghost" onPress={() => void logout()}>
          Salir
        </AppButton>
      </YStack>
    </SafeAreaView>
  );
}
