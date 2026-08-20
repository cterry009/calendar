import { completedPomodoroDateKeys, computePomodoroStreak } from '@calendar/shared';
import { AppButton, AppCard, Eyebrow, H1, H2, Paragraph, Text, YStack } from '@calendar/ui';
import { useMemo } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScheduleRow } from '../components/calendar/ScheduleRow';
import { TaskRow } from '../components/calendar/TaskRow';
import { useAuth } from '../context/AuthContext';
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
  const { tasks, schedules, isLoading, isMutating, error, completeTask } = useCalendarData();

  const today = useMemo(() => new Date(), []);

  const todayTasks = useMemo(
    () => tasks.filter((task) => task.scheduledAt && isSameDay(new Date(task.scheduledAt), today)),
    [tasks, today],
  );

  const todaySchedules = useMemo(
    () => schedules.filter((schedule) => schedule.enabled && schedule.daysOfWeek.includes(today.getDay())),
    [schedules, today],
  );

  // Trivial use of shared business logic, proving @calendar/shared (pure, no DOM/browser
  // globals) runs unmodified on native -- ported from the scaffold's original proof screen.
  const streak = useMemo(() => computePomodoroStreak(completedPomodoroDateKeys([])), []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#212e28' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <YStack flex={1} padding="$6" gap="$5">
          <YStack gap="$1">
            <Eyebrow>Calendar Productivity</Eyebrow>
            <H1 marginTop={0} marginBottom={0} textTransform="capitalize">
              {TODAY_LABEL}
            </H1>
            <Paragraph color="$muted" margin={0}>
              Hola{user?.name ? `, ${user.name}` : ''} -- sesion iniciada como {user?.email}.
            </Paragraph>
          </YStack>

          {error ? (
            <Text color="$danger" fontSize="$3">
              {error}
            </Text>
          ) : null}

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

          <AppCard>
            <YStack gap="$3">
              <Text fontWeight="700">Racha de pomodoros</Text>
              <Paragraph margin={0} color="$muted">
                {streak.currentStreak} dias seguidos.
              </Paragraph>
            </YStack>
          </AppCard>

          <AppButton variant="ghost" onPress={() => void logout()}>
            Salir
          </AppButton>
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
