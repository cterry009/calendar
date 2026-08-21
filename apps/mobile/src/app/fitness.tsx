import { AppButton, AppCard, Eyebrow, H1, H2, Paragraph, Text, YStack } from '@calendar/ui';
import { Pedometer } from 'expo-sensors';
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { FitnessForm } from '../components/fitness/FitnessForm';
import { FitnessItem } from '../components/fitness/FitnessItem';
import { TutorialTarget } from '../components/onboarding/TutorialTarget';
import { useOnboarding } from '../context/OnboardingContext';
import { useDailySteps } from '../hooks/useDailySteps';
import { useFitness } from '../hooks/useFitness';
import { buildDailySummary } from '../lib/fitness/summary';

/**
 * Fourth slice of task 6.2. Mirrors apps/web's FitnessPage.tsx: a daily-minutes summary, a
 * toggleable create form, and a compact list -- not the fitness-productivity correlation panel
 * (that lives on the dashboard, not this page, on web either) and not editing existing entries
 * (create + delete only, same "compact first slice" scope as the tasks screen).
 */
export default function FitnessScreen() {
  const { entries, isLoading, isMutating, error, createEntry, deleteEntry } = useFitness();
  const [showForm, setShowForm] = useState(false);
  const { startTour } = useOnboarding();
  const dailySteps = useDailySteps();

  const todaySummary = useMemo(() => buildDailySummary(entries, new Date()), [entries]);

  return (
    <YStack flex={1} backgroundColor="$background">
      <Stack.Screen
        options={{
          title: 'Fitness',
          headerShown: true,
          headerStyle: { backgroundColor: '#212e28' },
          headerTintColor: '#f2f7f4',
          headerRight: () => (
            <AppButton variant="ghost" paddingHorizontal="$2" onPress={() => startTour('fitness')}>
              ?
            </AppButton>
          ),
        }}
      />

      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <YStack width="100%" maxWidth={560} alignSelf="center" padding="$6" gap="$5">
          <YStack gap="$1">
            <Eyebrow>Bienestar</Eyebrow>
            <H1 marginTop={0} marginBottom={0}>
              Fitness
            </H1>
          </YStack>

          {error ? (
            <Text color="$danger" fontSize="$3">
              {error}
            </Text>
          ) : null}

          <TutorialTarget id="fitness-summary">
            <AppCard>
              <YStack gap="$2">
                <Text fontWeight="700">Hoy</Text>
                <Paragraph margin={0} color="$muted">
                  {todaySummary.totalMinutes} min en {todaySummary.sessionCount} sesion(es).
                </Paragraph>
              </YStack>
            </AppCard>
          </TutorialTarget>

          <TutorialTarget id="fitness-steps">
            <AppCard>
              <YStack gap="$2">
                <Text fontWeight="700">Pasos de hoy</Text>
                {dailySteps.isAvailable === false ? (
                  <Paragraph margin={0} color="$muted">
                    Este dispositivo no tiene sensor de pasos, o esta funcion solo esta disponible
                    en Android.
                  </Paragraph>
                ) : dailySteps.isLoading ? (
                  <Paragraph margin={0} color="$muted">
                    Cargando...
                  </Paragraph>
                ) : dailySteps.permissionStatus !== Pedometer.PermissionStatus.GRANTED ? (
                  <YStack gap="$2">
                    <Paragraph margin={0} color="$muted">
                      Activa el permiso de actividad fisica para contar tus pasos mientras la app
                      esta abierta.
                    </Paragraph>
                    <AppButton variant="primary" onPress={() => void dailySteps.requestPermission()}>
                      Activar contador de pasos
                    </AppButton>
                  </YStack>
                ) : (
                  <YStack gap="$1">
                    <Text fontSize="$9" fontWeight="700">
                      {dailySteps.steps}
                    </Text>
                    <Paragraph margin={0} color="$muted" fontSize="$2">
                      Solo cuenta mientras la app esta abierta -- se suma cada vez que la volves a
                      abrir en el dia.
                    </Paragraph>
                  </YStack>
                )}
              </YStack>
            </AppCard>
          </TutorialTarget>

          <AppButton variant={showForm ? 'ghost' : 'primary'} onPress={() => setShowForm((value) => !value)}>
            {showForm ? 'Cancelar' : 'Nuevo registro'}
          </AppButton>

          {showForm ? (
            <FitnessForm
              isSubmitting={isMutating}
              onCancel={() => setShowForm(false)}
              onSubmit={async (values) => {
                await createEntry(values);
                setShowForm(false);
              }}
            />
          ) : null}

          <TutorialTarget id="fitness-list">
            <AppCard>
              <YStack gap="$1">
                <H2 margin={0} fontSize="$5">
                  Registros
                </H2>
                {isLoading ? (
                  <Paragraph margin={0} color="$muted">
                    Cargando...
                  </Paragraph>
                ) : entries.length === 0 ? (
                  <Paragraph margin={0} color="$muted">
                    Todavia no hay registros de fitness.
                  </Paragraph>
                ) : (
                  <YStack>
                    {entries.map((entry) => (
                      <FitnessItem key={entry.id} entry={entry} isBusy={isMutating} onDelete={() => void deleteEntry(entry.id)} />
                    ))}
                  </YStack>
                )}
              </YStack>
            </AppCard>
          </TutorialTarget>
        </YStack>
      </ScrollView>
    </YStack>
  );
}
