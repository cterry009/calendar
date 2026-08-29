import { completedPomodoroDateKeys, computePomodoroStreak } from '@calendar/shared';
import { AppButton, AppCard, Eyebrow, H1, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { Link } from 'expo-router';
import { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScheduleRow } from '../components/calendar/ScheduleRow';
import { TaskRow } from '../components/calendar/TaskRow';
import { TutorialScrollView } from '../components/onboarding/TutorialScrollView';
import { TutorialTarget } from '../components/onboarding/TutorialTarget';
import { useAuth } from '../context/AuthContext';
import { useOnboarding } from '../context/OnboardingContext';
import { useCalendarData } from '../hooks/useCalendarData';
import { isSameDay } from '../lib/calendar/utils';

const TODAY_LABEL = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

/**
 * Home / "today" screen -- second slice of task 6.2 (first was auth). Shows today's scheduled
 * tasks and today's work/rest schedule, fetched live from /sync/pull (no offline cache/live
 * updates yet, that's task 6.3). Mirrors the compact info density of apps/web's
 * DayTasksSidebar/ScheduleItem, not the full drag-and-drop calendar grid -- that's a much
 * bigger native-specific UI effort left for a later pass.
 */
export default function HomeScreen() {
  const { user, logout } = useAuth();
  const { startTour } = useOnboarding();
  const { tasks, schedules, pomodoroSessions, isLoading, isMutating, error, completeTask } = useCalendarData();

  const today = useMemo(() => new Date(), []);

  const todayTasks = useMemo(
    () => tasks.filter((task) => task.scheduledAt && isSameDay(new Date(task.scheduledAt), today)),
    [tasks, today],
  );

  const todaySchedules = useMemo(
    () => schedules.filter((schedule) => schedule.enabled && schedule.daysOfWeek.includes(today.getDay())),
    [schedules, today],
  );

  const streak = useMemo(
    () => computePomodoroStreak(completedPomodoroDateKeys(pomodoroSessions)),
    [pomodoroSessions],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#212e28' }}>
      <TutorialScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <YStack flex={1} width="100%" maxWidth={560} alignSelf="center" padding="$6" gap="$5">
          <YStack gap="$1">
            <XStack justifyContent="space-between" alignItems="flex-start">
              <Eyebrow>Calendar Productivity</Eyebrow>
              <AppButton variant="ghost" paddingHorizontal="$2" onPress={() => startTour('global')}>
                ?
              </AppButton>
            </XStack>
            <H1 marginTop={0} marginBottom={0} textTransform="capitalize">
              {TODAY_LABEL}
            </H1>
            <Paragraph color="$muted" margin={0}>
              Hola{user?.name ? `, ${user.name}` : ''} -- sesion iniciada como {user?.email}.
            </Paragraph>
          </YStack>

          {/* flexBasis 140 forces a 2-per-row wrap on any screen narrower than ~600dp (4 * 140
              plus gaps never fits one line below that) -- a plain flex={1} 4-across row squeezed
              each label into ~50dp on a real phone, truncating "Dashboard"/"Pomodoro" to a single
              letter. */}
          <TutorialTarget id="home-nav">
            <XStack flexWrap="wrap" gap="$3">
              <Link href="/pomodoro" asChild>
                <AppButton variant="ghost" flexGrow={1} flexBasis={140}>
                  Pomodoro
                </AppButton>
              </Link>
              <Link href="/fitness" asChild>
                <AppButton variant="ghost" flexGrow={1} flexBasis={140}>
                  Fitness
                </AppButton>
              </Link>
              <Link href="/dashboard" asChild>
                <AppButton variant="ghost" flexGrow={1} flexBasis={140}>
                  Dashboard
                </AppButton>
              </Link>
              <Link href="/blocklist" asChild>
                <AppButton variant="ghost" flexGrow={1} flexBasis={140}>
                  Bloqueo
                </AppButton>
              </Link>
              <Link href="/habits" asChild>
                <AppButton variant="ghost" flexGrow={1} flexBasis={140}>
                  Habitos
                </AppButton>
              </Link>
              <Link href="/screen-time" asChild>
                <AppButton variant="ghost" flexGrow={1} flexBasis={140}>
                  Tiempo de pantalla
                </AppButton>
              </Link>
            </XStack>
          </TutorialTarget>

          {error ? (
            <Text color="$danger" fontSize="$3">
              {error}
            </Text>
          ) : null}

          <TutorialTarget id="home-tasks">
            <AppCard>
              <YStack gap="$3">
                <H2 margin={0} fontSize="$5">
                  Tareas de hoy
                </H2>
                {isLoading ? (
                  <Paragraph margin={0} color="$muted">
                    Cargando...
                  </Paragraph>
                ) : todayTasks.length === 0 ? (
                  <Paragraph margin={0} color="$muted">
                    No hay tareas programadas para hoy.
                  </Paragraph>
                ) : (
                  <YStack>
                    {todayTasks.map((task) => (
                      <TaskRow key={task.id} task={task} isBusy={isMutating} onComplete={() => void completeTask(task)} />
                    ))}
                  </YStack>
                )}
              </YStack>
            </AppCard>
          </TutorialTarget>

          <TutorialTarget id="home-schedule">
            <AppCard>
              <YStack gap="$3">
                <H2 margin={0} fontSize="$5">
                  Horario de hoy
                </H2>
                {isLoading ? (
                  <Paragraph margin={0} color="$muted">
                    Cargando...
                  </Paragraph>
                ) : todaySchedules.length === 0 ? (
                  <Paragraph margin={0} color="$muted">
                    No hay horarios configurados para hoy.
                  </Paragraph>
                ) : (
                  <YStack>
                    {todaySchedules.map((schedule) => (
                      <ScheduleRow key={schedule.id} schedule={schedule} />
                    ))}
                  </YStack>
                )}
              </YStack>
            </AppCard>
          </TutorialTarget>

          <TutorialTarget id="home-streak">
            <AppCard>
              <YStack gap="$3">
                <Text fontWeight="700">Racha de pomodoros</Text>
                <Paragraph margin={0} color="$muted">
                  {streak.currentStreak} dias seguidos.
                </Paragraph>
              </YStack>
            </AppCard>
          </TutorialTarget>

          <AppButton variant="ghost" onPress={() => void logout()}>
            Salir
          </AppButton>
        </YStack>
      </TutorialScrollView>
    </SafeAreaView>
  );
}
