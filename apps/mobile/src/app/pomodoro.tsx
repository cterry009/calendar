import { AppButton, AppCard, Eyebrow, H1, Paragraph, Text, YStack } from '@calendar/ui';
import { finishPomodoroPhrase } from '@calendar/shared';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { TutorialTarget } from '../components/onboarding/TutorialTarget';
import { useOnboarding } from '../context/OnboardingContext';
import { usePomodoro } from '../context/PomodoroContext';
import { useBlockExit } from '../hooks/useBlockFocus';
import { useCalendarData } from '../hooks/useCalendarData';
import { blockToday } from '../lib/blockPrompt/block';
import { activeWorkSchedule } from '@calendar/shared';
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
    startBlock,
    cancel,
    reset,
  } = usePomodoro();
  const { schedules, tasks, skipped } = useCalendarData();
  const { leave, comeBack, isOut, exits } = useBlockExit();
  const inBlock = Boolean(session?.active && session.scheduleId);
  const blockLabel = inBlock ? schedules.find((s) => s.id === session?.scheduleId)?.label : null;

  // "Volver" on the phone's out-of-the-block bar opens this screen with ?volver=1.
  const { volver } = useLocalSearchParams<{ volver?: string }>();
  const handledVolver = useRef(false);
  useEffect(() => {
    if (volver !== '1' || handledVolver.current || isLoading) return;
    handledVolver.current = true;
    if (isOut) void comeBack();
  }, [volver, isOut, isLoading, comeBack]);
  const phrase =
    inBlock && session && (isOut || session.state === 'FOCUS')
      ? finishPomodoroPhrase(remainingSeconds / 60, session.id + ':' + session.completedCycles + ':' + session.state, isOut)
      : null;

  // Started inside a WORK block, the pomodoro runs in block mode and ends with the block; a plain
  // one cycles focus/break until cancelled, which on the phone looked like a block that never ended.
  const startFocus = async () => {
    const now = new Date();
    const work = activeWorkSchedule(schedules, now, skipped);
    const block = work ? blockToday({ ...work, scheduleId: work.id }, tasks, now) : null;
    if (work && block && now < block.endAt) {
      const id = await startBlock({
        scheduleId: work.id,
        blockStartAt: block.startAt,
        blockEndAt: block.endAt,
        profile: block.profile,
        taskId: block.tasks[0]?.id ?? null,
        timing: { focusMin: block.focusMin, breakMin: block.breakMin },
      });
      // Too little of the block left for a pomodoro: a plain one instead.
      if (id) return;
    }
    await start();
  };

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
                {isOut ? 'Fuera del bloque' : PHASE_LABELS[phase] ?? phase}
              </Text>
              {inBlock ? (
                <Text fontSize="$4" fontWeight="700" textAlign="center">
                  {blockLabel ?? 'Bloque de trabajo'}
                </Text>
              ) : null}

              <Text fontSize={64} fontWeight="700">
                {formatTimer(remainingSeconds)}
              </Text>

              <Text color="$muted" fontSize="$2" textAlign="center">
                {isOut
                  ? 'En pausa: te falta esto del pomodoro, y no cuenta hasta que vuelvas.'
                  : phaseDurationMinutes
                    ? `${Math.round(phaseDurationMinutes)} min`
                    : 'Presiona iniciar para comenzar un ciclo'}
              </Text>
              {phrase ? (
                <Text color="$accent" fontSize="$4" fontWeight="700" textAlign="center">
                  {phrase}
                </Text>
              ) : null}
              {inBlock ? (
                <Text color={exits > 0 ? '$warning' : '$muted'} fontSize="$3" fontWeight="600">
                  {exits === 0 ? 'Sin salidas en este bloque' : `Saliste ${exits} ${exits === 1 ? 'vez' : 'veces'} de este bloque`}
                </Text>
              ) : null}

              <YStack gap="$3" width="100%">
                {inBlock ? (
                  isOut ? (
                    <AppButton variant="primary" onPress={() => void comeBack()} disabled={isMutating}>
                      Volver al bloque
                    </AppButton>
                  ) : (
                    <AppButton variant="ghost" onPress={() => void leave()} disabled={isMutating}>
                      Salir (deja de contar el tiempo)
                    </AppButton>
                  )
                ) : isActive ? (
                  <>
                    <AppButton variant="ghost" onPress={() => void cancel()} disabled={isMutating}>
                      Cancelar
                    </AppButton>
                  </>
                ) : (
                  <AppButton variant="primary" onPress={() => void startFocus()} disabled={isLoading || isMutating}>
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
