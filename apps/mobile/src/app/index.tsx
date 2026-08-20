import { completedPomodoroDateKeys, computePomodoroStreak } from '@calendar/shared';
import { AppButton, AppCard, Eyebrow, H1, Paragraph, Text, YStack } from '@calendar/ui';
import { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Scaffold proof screen (task 6.1): confirms @calendar/ui (Tamagui design system) and
 * @calendar/shared (pure domain logic) both resolve and run on native, not just web.
 * Real screens (calendar, tasks, pomodoro...) are ported in 6.2, not here.
 */
export default function HomeScreen() {
  const [tapCount, setTapCount] = useState(0);

  // Trivial use of shared business logic with an empty history, just to prove the
  // pure @calendar/shared package (no DOM/browser globals) runs unmodified on native.
  const streak = useMemo(() => computePomodoroStreak(completedPomodoroDateKeys([])), []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#212e28' }}>
      <YStack flex={1} padding="$6" gap="$5" justifyContent="center">
        <YStack gap="$1">
          <Eyebrow>Calendar Productivity</Eyebrow>
          <H1 marginTop={0} marginBottom={0}>
            Hola desde Android
          </H1>
          <Paragraph color="$muted" margin={0}>
            Scaffold de Expo conectado al mismo sistema de diseno (@calendar/ui) y a la misma
            logica de negocio pura (@calendar/shared) que usa la web. Las pantallas reales
            (calendario, tareas, pomodoro) se portan en la tarea 6.2.
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

        <AppCard>
          <YStack gap="$3">
            <Text fontWeight="700">Componente compartido (@calendar/ui)</Text>
            <AppButton variant="primary" onPress={() => setTapCount((count) => count + 1)}>
              Toques: {tapCount}
            </AppButton>
          </YStack>
        </AppCard>
      </YStack>
    </SafeAreaView>
  );
}
