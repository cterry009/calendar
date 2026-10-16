import { AppButton, AppCard, Eyebrow, H1, Paragraph, Text, YStack } from '@calendar/ui';
import { finishPomodoroPhrase, studyProgress, studySessionLine } from '@calendar/shared';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { TutorialTarget } from '../components/onboarding/TutorialTarget';
import { useOnboarding } from '../context/OnboardingContext';
import { usePomodoro } from '../context/PomodoroContext';
import { useBlockExit } from '../hooks/useBlockFocus';
import { openExitSheet } from '../lib/blockPrompt/exitSheet';
import { openReviewSheet, pomodoroReviewRequest } from '../lib/blockPrompt/reviewSheet';
import { useCalendarData } from '../hooks/useCalendarData';
import { blockTaskId, blockToday } from '../lib/blockPrompt/block';
import { activeWorkSchedule } from '@calendar/shared';
import { formatTimer } from '../lib/pomodoro/timer';
import { SequenceTimeline } from '../components/pomodoro/SequenceTimeline';

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
  const { schedules, tasks, skipped, exceptions, completeTask } = useCalendarData();
  const { leave, comeBack, isOut, exits } = useBlockExit();
  const inBlock = Boolean(session?.active && session.scheduleId);
  const blockLabel = inBlock ? schedules.find((s) => s.id === session?.scheduleId)?.label : null;
  // The study session this pomodoro is on, and how every line is going (2026-10-07).
  const studyTask = session?.taskId ? tasks.find((t) => t.id === session.taskId) ?? null : null;
  const progress = studyProgress(tasks).filter((line) => line.total > 0);

  // "Volver" on the phone's out-of-the-block bar opens this screen with ?volver=1.
  const {
    volver,
    salir,
    review,
    scheduleId: reviewScheduleId,
    sessionId: reviewSessionId,
    cycle: reviewCycle,
    rating: reviewRating,
    taskId: reviewTaskId,
    askSession: reviewAskSession,
  } = useLocalSearchParams<{
    volver?: string;
    salir?: string;
    review?: string;
    scheduleId?: string;
    sessionId?: string;
    cycle?: string;
    rating?: string;
    taskId?: string;
    askSession?: string;
  }>();

  // The phone's per-pomodoro card opens this screen with the rating picked: finish the review here.
  const handledReview = useRef(false);
  useEffect(() => {
    if (review !== '1' || handledReview.current || !reviewScheduleId || !reviewSessionId || !reviewCycle) return;
    handledReview.current = true;
    void openReviewSheet(
      pomodoroReviewRequest(reviewSessionId, Number(reviewCycle), reviewScheduleId, reviewTaskId || null, {
        askSession: reviewAskSession === '1',
        rating: reviewRating ? Number(reviewRating) : undefined,
      }),
    );
  }, [review, reviewScheduleId, reviewSessionId, reviewCycle, reviewRating, reviewTaskId, reviewAskSession]);
  const handledVolver = useRef(false);
  useEffect(() => {
    if (volver !== '1' || handledVolver.current || isLoading) return;
    handledVolver.current = true;
    if (isOut) void comeBack();
  }, [volver, isOut, isLoading, comeBack]);

  // "Salir" on the overlay (already paused there) opens this screen with ?salir=1: ask why.
  const handledSalir = useRef(false);
  useEffect(() => {
    if (salir !== '1' || handledSalir.current || isLoading || !inBlock) return;
    handledSalir.current = true;
    openExitSheet({ alreadyPaused: true });
  }, [salir, isLoading, inBlock]);
  const phrase =
    inBlock && session && (isOut || session.state === 'FOCUS')
      ? finishPomodoroPhrase(remainingSeconds / 60, session.id + ':' + session.completedCycles + ':' + session.state, isOut)
      : null;

  // Started inside a WORK block, the pomodoro runs in block mode and ends with the block; a plain
  // one cycles focus/break until cancelled, which on the phone looked like a block that never ended.
  const startFocus = async () => {
    const now = new Date();
    const work = activeWorkSchedule(schedules, now, skipped, exceptions);
    const block = work ? blockToday({ ...work, scheduleId: work.id }, tasks, now) : null;
    if (work && block && now < block.endAt) {
      const id = await startBlock({
        scheduleId: work.id,
        blockStartAt: block.startAt,
        blockEndAt: block.endAt,
        profile: block.profile,
        taskId: blockTaskId(block, work.label, tasks),
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
              {studyTask && session ? (
                <Text fontSize="$3" textAlign="center" color={studyTask.status === 'COMPLETED' ? '$accent' : '$color'}>
                  {studySessionLine(studyTask, session)}
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
              <SequenceTimeline />
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

        {studyTask && studyTask.status !== 'COMPLETED' ? (
          <AppButton variant="ghost" disabled={isMutating} onPress={() => void completeTask(studyTask)}>
            Marcar la sesión como completada
          </AppButton>
        ) : null}

        {progress.length > 0 ? (
          <AppCard>
            <YStack gap="$2">
              <Text fontWeight="700">Avance de estudio</Text>
              {progress.map((line) => (
                <YStack key={line.line} gap="$1">
                  <Text fontSize="$3">
                    {line.name}: {line.done} de {line.total} sesiones
                  </Text>
                  {line.next ? (
                    <Text fontSize="$2" color="$muted" numberOfLines={1}>
                      Sigue: {line.next}
                    </Text>
                  ) : null}
                </YStack>
              ))}
            </YStack>
          </AppCard>
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
