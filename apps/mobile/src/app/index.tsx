import { completedPomodoroDateKeys, computePomodoroStreak } from '@calendar/shared';
import { AppButton, AppCard, Eyebrow, H1, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScheduleRow } from '../components/calendar/ScheduleRow';
import { TaskRow } from '../components/calendar/TaskRow';
import { HabitChecklistRow } from '../components/habits/HabitChecklistRow';
import { TutorialScrollView } from '../components/onboarding/TutorialScrollView';
import { TutorialTarget } from '../components/onboarding/TutorialTarget';
import { useAuth } from '../context/AuthContext';
import { useOnboarding } from '../context/OnboardingContext';
import { useCalendarData } from '../hooks/useCalendarData';
import { useHabits } from '../hooks/useHabits';
import { DAY_ABBREVIATIONS_ES, isSameDay } from '../lib/calendar/utils';
import { todayKey } from '../lib/habits/today';

const TODAY_LABEL = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - result.getDay());
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Home screen -- second slice of task 6.2 (first was auth). Leads with a checkable habits list
 * (today only) and a week strip that re-filters the "Tareas extra"/schedule cards below it to
 * whichever day is tapped, both already fully fetched by /sync/pull so switching days is a
 * client-side filter, no refetch. No offline cache/live updates yet (task 6.3), and still no full
 * drag-and-drop calendar grid -- that's a much bigger native-specific UI effort left for a later
 * pass.
 */
export default function HomeScreen() {
  const { user, logout } = useAuth();
  const { startTour } = useOnboarding();
  const { tasks, schedules, pomodoroSessions, isLoading, isMutating, error, completeTask } = useCalendarData();
  const {
    habits,
    records: habitRecords,
    isLoading: isHabitsLoading,
    isMutating: isHabitsMutating,
    checkIn,
  } = useHabits();

  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState(today);

  // Sun..Sat of the current week -- switching selectedDate re-filters tasks/schedules (both
  // already fully fetched by pullSnapshot, see useCalendarData.ts) client-side, same as the
  // isSameDay filter this replaces. Habits stay pinned to today below: a check-in only ever means
  // "today," matching what the reminder notification's action buttons already do (task 11.6).
  const weekDates = useMemo(() => {
    const start = startOfWeek(today);
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      return date;
    });
  }, [today]);

  const activeHabits = useMemo(() => habits.filter((habit) => !habit.archived), [habits]);

  const selectedTasks = useMemo(
    () => tasks.filter((task) => task.scheduledAt && isSameDay(new Date(task.scheduledAt), selectedDate)),
    [tasks, selectedDate],
  );

  const selectedSchedules = useMemo(
    () => schedules.filter((schedule) => schedule.enabled && schedule.daysOfWeek.includes(selectedDate.getDay())),
    [schedules, selectedDate],
  );

  const streak = useMemo(
    () => computePomodoroStreak(completedPomodoroDateKeys(pomodoroSessions)),
    [pomodoroSessions],
  );

  function handleHabitComplete(habitId: string) {
    void checkIn(habitId, { date: todayKey(), value: 1, status: 'DONE' });
  }

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

          <TutorialTarget id="home-week">
            <XStack gap="$2" justifyContent="space-between">
              {weekDates.map((date) => {
                const isSelected = isSameDay(date, selectedDate);
                const isToday = isSameDay(date, today);
                return (
                  <YStack
                    key={date.toISOString()}
                    flex={1}
                    alignItems="center"
                    gap="$1"
                    paddingVertical="$2"
                    borderRadius={12}
                    backgroundColor={isSelected ? '$accent' : 'transparent'}
                    borderWidth={1}
                    borderColor={isSelected ? '$accent' : isToday ? '$accent' : '$borderColor'}
                    onPress={() => setSelectedDate(date)}
                  >
                    <Text fontSize="$1" fontWeight="600" color={isSelected ? '#0a1c13' : '$muted'}>
                      {DAY_ABBREVIATIONS_ES[date.getDay()]}
                    </Text>
                    <Text fontSize="$4" fontWeight="700" color={isSelected ? '#0a1c13' : '$color'}>
                      {date.getDate()}
                    </Text>
                  </YStack>
                );
              })}
            </XStack>
          </TutorialTarget>

          <TutorialTarget id="home-habits">
            <AppCard>
              <YStack gap="$1">
                <H2 margin={0} fontSize="$5">
                  Habitos de hoy
                </H2>
                {isHabitsLoading ? (
                  <Paragraph margin={0} color="$muted">
                    Cargando...
                  </Paragraph>
                ) : activeHabits.length === 0 ? (
                  <Paragraph margin={0} color="$muted">
                    Todavia no agregaste ningun habito.
                  </Paragraph>
                ) : (
                  <YStack>
                    {activeHabits.map((habit) => (
                      <HabitChecklistRow
                        key={habit.id}
                        habit={habit}
                        records={habitRecords}
                        isBusy={isHabitsMutating}
                        onComplete={() => handleHabitComplete(habit.id)}
                      />
                    ))}
                  </YStack>
                )}
              </YStack>
            </AppCard>
          </TutorialTarget>

          <TutorialTarget id="home-tasks">
            <AppCard>
              <YStack gap="$3">
                <H2 margin={0} fontSize="$5">
                  Tareas extra
                </H2>
                {isLoading ? (
                  <Paragraph margin={0} color="$muted">
                    Cargando...
                  </Paragraph>
                ) : selectedTasks.length === 0 ? (
                  <Paragraph margin={0} color="$muted">
                    No hay tareas programadas para este dia.
                  </Paragraph>
                ) : (
                  <YStack gap="$2">
                    {selectedTasks.map((task) => (
                      <YStack key={task.id} backgroundColor="$overlaySubtle" borderRadius={10} paddingHorizontal="$3">
                        <TaskRow task={task} isBusy={isMutating} onComplete={() => void completeTask(task)} />
                      </YStack>
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
                ) : selectedSchedules.length === 0 ? (
                  <Paragraph margin={0} color="$muted">
                    No hay horarios configurados para este dia.
                  </Paragraph>
                ) : (
                  <YStack>
                    {selectedSchedules.map((schedule) => (
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
