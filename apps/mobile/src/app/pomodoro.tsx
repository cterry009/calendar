import { AppButton, AppCard, Eyebrow, H1, Paragraph, Text, YStack } from '@calendar/ui';
import { Link, Stack } from 'expo-router';
import { TutorialTarget } from '../components/onboarding/TutorialTarget';
import { useOnboarding } from '../context/OnboardingContext';
import { usePomodoro } from '../context/PomodoroContext';
import { formatTimer } from '../lib/pomodoro/timer';

const PHASE_LABELS: Record<string, string> = {
  IDLE: 'En espera',
  FOCUS: 'Enfoque',
  SHORT_BREAK: 'Descanso corto',
  LONG_BREAK: 'Descanso largo',
};

/**
 * Third slice of task 6.2. Ported from apps/web's PomodoroTimer.tsx -- same wall-clock-diff
 * timer (PomodoroContext computes remainingSeconds from startedAt, not an accumulated
 * countdown, so it can't drift even if the interval gets throttled in the background).
 * Per-session config overrides are still cut (see PomodoroContext); phase-complete
 * notifications are real now (task 6.4), toggled below.
 */
export default function PomodoroScreen() {
  const {
    session,
    remainingSeconds,
    phaseDurationMinutes,
    isLoading,
    isMutating,
    error,
    notificationsEnabled,
    toggleNotifications,
    start,
    cancel,
    reset,
  } = usePomodoro();

  const phase = session?.state ?? 'IDLE';
  const isActive = Boolean(session?.active);
  const { startTour } = useOnboarding();

  return (
    <YStack flex={1} backgroundColor="$background" alignItems="center">
      <YStack flex={1} width="100%" maxWidth={560} padding="$6" gap="$5" justifyContent="center">
        <Stack.Screen
          options={{
            title: 'Pomodoro',
            headerShown: true,
            headerStyle: { backgroundColor: '#212e28' },
            headerTintColor: '#f2f7f4',
            headerRight: () => (
              <AppButton variant="ghost" paddingHorizontal="$2" onPress={() => startTour('pomodoro')}>
                ?
              </AppButton>
            ),
          }}
        />

        <YStack gap="$1">
          <Eyebrow>Productividad</Eyebrow>
          <H1 marginTop={0} marginBottom={0}>
            Temporizador pomodoro
          </H1>
        </YStack>

        {error ? (
          <Text color="$danger" fontSize="$3">
            {error}
          </Text>
        ) : null}

        <TutorialTarget id="pomodoro-timer">
          <AppCard>
            <YStack gap="$4" alignItems="center" paddingVertical="$4">
              <Text color="$muted" fontSize="$2" textTransform="uppercase" letterSpacing={1.5}>
                {PHASE_LABELS[phase] ?? phase}
              </Text>

              <Text fontSize={64} fontWeight="700">
                {formatTimer(remainingSeconds)}
              </Text>

              <Text color="$muted" fontSize="$2">
                {phaseDurationMinutes ? `${phaseDurationMinutes} min` : 'Presiona iniciar para comenzar un ciclo'}
              </Text>

              <YStack gap="$3" width="100%">
                {isActive ? (
                  <>
                    <AppButton variant="ghost" onPress={() => void cancel()} disabled={isMutating}>
                      Cancelar
                    </AppButton>
                  </>
                ) : (
                  <AppButton variant="primary" onPress={() => void start()} disabled={isLoading || isMutating}>
                    {isLoading ? 'Cargando...' : 'Iniciar enfoque'}
                  </AppButton>
                )}

                {!isActive && session ? (
                  <AppButton variant="ghost" onPress={() => void reset()} disabled={isMutating}>
                    Reiniciar ciclos
                  </AppButton>
                ) : null}
              </YStack>
            </YStack>
          </AppCard>
        </TutorialTarget>

        {session ? (
          <Paragraph color="$muted" textAlign="center" margin={0}>
            Ciclos completados: {session.completedCycles}
          </Paragraph>
        ) : null}

        <TutorialTarget id="pomodoro-notifications">
          <AppButton
            variant={notificationsEnabled ? 'primary' : 'ghost'}
            onPress={() => void toggleNotifications(!notificationsEnabled)}
          >
            {notificationsEnabled ? 'Notificaciones activadas' : 'Activar notificaciones de fin de fase'}
          </AppButton>
        </TutorialTarget>

        <Link href="/" asChild>
          <AppButton variant="ghost">Volver</AppButton>
        </Link>
      </YStack>
    </YStack>
  );
}
