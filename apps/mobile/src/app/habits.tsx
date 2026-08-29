import { AppButton, AppCard, Eyebrow, H1, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { HabitForm } from '../components/habits/HabitForm';
import { HabitRow } from '../components/habits/HabitRow';
import { TutorialScrollView } from '../components/onboarding/TutorialScrollView';
import { TutorialTarget } from '../components/onboarding/TutorialTarget';
import { useOnboarding } from '../context/OnboardingContext';
import { useHabits } from '../hooks/useHabits';
import { HABIT_TEMPLATES } from '../lib/habits/templates';
import { todayKey } from '../lib/habits/today';

/**
 * Task 11.4: mobile port of apps/web's Habits feature (Habit/HabitRecord, already real and
 * synced server-side, just never had a mobile screen). List + manual Si/No check-in for today +
 * a create form -- no calendar grid, streaks, journal notes, or habit editing, matching every
 * other "compact first slice" screen in this port (blocklist.tsx, fitness.tsx). The six specific
 * daily habits the user asked for (wake-up time, arreglarse, deporte, perro, trabajo, estudio)
 * get seeded as quick-add templates in task 11.7, once the reminder-time schema fields (task
 * 11.5) they need exist -- a template without a reminder window would just be a prefilled
 * generic form, not the actual point of "quick-add."
 */
export default function HabitsScreen() {
  const { habits, records, isLoading, isMutating, error, createHabit, deleteHabit, checkIn } = useHabits();
  const { startTour } = useOnboarding();
  const [showForm, setShowForm] = useState(false);

  const activeHabits = habits.filter((habit) => !habit.archived);

  // A template is offered until a habit with the same title already exists -- simple dedupe, no
  // separate "this came from template X" tracking, consistent with there being no edit form yet
  // (title is the one field a template and a manually-created habit both use to mean "the same
  // thing").
  const activeTitles = useMemo(() => new Set(activeHabits.map((habit) => habit.title)), [activeHabits]);
  const availableTemplates = HABIT_TEMPLATES.filter((tpl) => !activeTitles.has(tpl.values.title));

  async function handleCreate(values: Parameters<typeof createHabit>[0]) {
    await createHabit(values);
    setShowForm(false);
  }

  function handleCheckIn(habitId: string, status: 'DONE' | 'SKIPPED') {
    void checkIn(habitId, { date: todayKey(), value: status === 'DONE' ? 1 : 0, status });
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      <Stack.Screen
        options={{
          title: 'Habitos',
          headerShown: true,
          headerStyle: { backgroundColor: '#212e28' },
          headerTintColor: '#f2f7f4',
          headerRight: () => (
            <AppButton variant="ghost" paddingHorizontal="$2" onPress={() => startTour('habits')}>
              ?
            </AppButton>
          ),
        }}
      />

      <TutorialScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <YStack width="100%" maxWidth={560} alignSelf="center" padding="$6" gap="$5">
          <YStack gap="$1">
            <Eyebrow>Bienestar</Eyebrow>
            <H1 marginTop={0} marginBottom={0}>
              Habitos
            </H1>
          </YStack>

          {error ? (
            <Text color="$danger" fontSize="$3">
              {error}
            </Text>
          ) : null}

          <TutorialTarget id="habits-today">
            <AppCard>
              <YStack gap="$1">
                <H2 margin={0} fontSize="$5">
                  Hoy
                </H2>
                {isLoading ? (
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
                      <HabitRow
                        key={habit.id}
                        habit={habit}
                        records={records}
                        isBusy={isMutating}
                        onCheckIn={(status) => handleCheckIn(habit.id, status)}
                        onDelete={() => void deleteHabit(habit.id)}
                      />
                    ))}
                  </YStack>
                )}
              </YStack>
            </AppCard>
          </TutorialTarget>

          {availableTemplates.length > 0 ? (
            <TutorialTarget id="habits-templates">
              <AppCard>
                <YStack gap="$2">
                  <H2 margin={0} fontSize="$5">
                    Plantillas rapidas
                  </H2>
                  <Paragraph margin={0} color="$muted">
                    Un toque para agregar, con su horario de recordatorio ya configurado.
                  </Paragraph>
                  <XStack gap="$2" flexWrap="wrap">
                    {availableTemplates.map((tpl) => (
                      <AppButton
                        key={tpl.id}
                        variant="ghost"
                        disabled={isMutating}
                        onPress={() => void createHabit(tpl.values)}
                      >
                        {tpl.label}
                      </AppButton>
                    ))}
                  </XStack>
                </YStack>
              </AppCard>
            </TutorialTarget>
          ) : null}

          <TutorialTarget id="habits-create">
            {showForm ? (
              <HabitForm isSubmitting={isMutating} onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
            ) : (
              <AppButton variant="primary" onPress={() => setShowForm(true)}>
                Agregar habito
              </AppButton>
            )}
          </TutorialTarget>
        </YStack>
      </TutorialScrollView>
    </YStack>
  );
}
