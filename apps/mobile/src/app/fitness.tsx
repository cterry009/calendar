import { AppButton, AppCard, Eyebrow, H1, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { PermissionStatus } from 'expo';
import { Pedometer } from 'expo-sensors';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { Input } from 'tamagui';
import { FitnessForm } from '../components/fitness/FitnessForm';
import { FitnessItem } from '../components/fitness/FitnessItem';
import { TutorialScrollView } from '../components/onboarding/TutorialScrollView';
import { TutorialTarget } from '../components/onboarding/TutorialTarget';
import { useOnboarding } from '../context/OnboardingContext';
import { useDailyFloors } from '../hooks/useDailyFloors';
import { useDailySteps } from '../hooks/useDailySteps';
import { useFitness } from '../hooks/useFitness';
import { buildDailySummary } from '../lib/fitness/summary';
import { getDailyStepGoal, getNativeDailySteps, isStepSensorAvailable, setDailyStepGoal } from '../lib/stepTracking/api';

// How often the in-app card polls the native foreground service's own count (a plain
// SharedPreferences read, not a network/sensor call, cheap enough at this interval). The
// persistent notification itself updates on every sensor event, independent of whether this
// screen is even open -- this poll is just so the in-app card doesn't look stale while it is.
const NATIVE_STEPS_POLL_MS = 5_000;

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
  const dailyFloors = useDailyFloors();

  const todaySummary = useMemo(() => buildDailySummary(entries, new Date()), [entries]);
  // Derived from the step count already being synced -- no extra sensor or sync entity needed.
  // Average adult stride length (~0.762m / 30in) is a rough industry-standard estimate, not a
  // per-user calibrated value.
  const distanceKm = useMemo(() => (dailySteps.steps * 0.762) / 1000, [dailySteps.steps]);

  // Task 11.16: the native foreground-service counter (its own, separate from dailySteps above --
  // see StepTrackingService.kt's doc comment for why this exists alongside Health Connect/
  // Pedometer rather than replacing them). This card is what's reflected in the persistent
  // notification.
  const [nativeSteps, setNativeSteps] = useState(0);
  const [nativeSensorAvailable, setNativeSensorAvailable] = useState<boolean | null>(null);
  const [goalInput, setGoalInput] = useState('8000');

  useEffect(() => {
    if (Platform.OS !== 'android') {
      setNativeSensorAvailable(false);
      return;
    }
    setNativeSensorAvailable(isStepSensorAvailable());
    setGoalInput(String(getDailyStepGoal()));

    const poll = () => setNativeSteps(getNativeDailySteps());
    poll();
    const intervalId = setInterval(poll, NATIVE_STEPS_POLL_MS);
    return () => clearInterval(intervalId);
  }, []);

  function saveGoal() {
    const goal = Number(goalInput);
    if (!Number.isFinite(goal) || goal <= 0) return;
    setDailyStepGoal(goal);
  }

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

      <TutorialScrollView contentContainerStyle={{ flexGrow: 1 }}>
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
                      Activa el permiso de actividad fisica para contar tus pasos.
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
                      ~{distanceKm.toFixed(2)} km recorridos hoy (estimado a partir de los pasos).
                    </Paragraph>
                    {dailySteps.source === 'health-connect' ? (
                      <Paragraph margin={0} color="$muted" fontSize="$2">
                        Cuenta las 24 horas via Health Connect, aunque la app este cerrada.
                      </Paragraph>
                    ) : (
                      <Paragraph margin={0} color="$muted" fontSize="$2">
                        Solo cuenta mientras la app esta abierta (Health Connect no esta disponible
                        en este dispositivo) -- se suma cada vez que la volves a abrir en el dia.
                      </Paragraph>
                    )}
                    <Paragraph margin={0} color="$muted" fontSize="$2">
                      Cuando detecta que estas trotando (con la app abierta o cerrada), tambien
                      registra un entrenamiento de "Trote" automaticamente.
                    </Paragraph>
                  </YStack>
                )}
              </YStack>
            </AppCard>
          </TutorialTarget>

          <TutorialTarget id="fitness-floors">
            <AppCard>
              <YStack gap="$2">
                <Text fontWeight="700">Pisos subidos hoy</Text>
                {dailyFloors.isAvailable === false ? (
                  <Paragraph margin={0} color="$muted">
                    Este dispositivo no tiene barometro, o esta funcion solo esta disponible en
                    Android.
                  </Paragraph>
                ) : dailyFloors.isLoading ? (
                  <Paragraph margin={0} color="$muted">
                    Cargando...
                  </Paragraph>
                ) : dailyFloors.permissionStatus !== PermissionStatus.GRANTED ? (
                  <YStack gap="$2">
                    <Paragraph margin={0} color="$muted">
                      Activa el permiso de sensores para contar los pisos que subis mientras la
                      app esta abierta.
                    </Paragraph>
                    <AppButton variant="primary" onPress={() => void dailyFloors.requestPermission()}>
                      Activar contador de pisos
                    </AppButton>
                  </YStack>
                ) : (
                  <YStack gap="$1">
                    <Text fontSize="$9" fontWeight="700">
                      {dailyFloors.floors}
                    </Text>
                    <Paragraph margin={0} color="$muted" fontSize="$2">
                      Estimado a partir del barometro (cambios de presion) -- solo cuenta mientras
                      la app esta abierta.
                    </Paragraph>
                  </YStack>
                )}
              </YStack>
            </AppCard>
          </TutorialTarget>

          {Platform.OS === 'android' ? (
            <TutorialTarget id="fitness-notification">
              <AppCard>
                <YStack gap="$2">
                  <Text fontWeight="700">Notificacion de progreso</Text>
                  {nativeSensorAvailable === false ? (
                    <Paragraph margin={0} color="$muted">
                      Este dispositivo no tiene sensor de contador de pasos.
                    </Paragraph>
                  ) : (
                    <YStack gap="$2">
                      <Paragraph margin={0} color="$muted" fontSize="$2">
                        Un servicio en primer plano cuenta tus pasos con el sensor del telefono
                        directamente, sin depender de Health Connect ni de que la app este
                        abierta -- por eso aparece una notificacion fija con tu progreso. Ahora:{' '}
                        {nativeSteps} pasos.
                      </Paragraph>
                      <XStack gap="$2" alignItems="center">
                        <Input
                          flex={1}
                          value={goalInput}
                          onChangeText={setGoalInput}
                          keyboardType="number-pad"
                          placeholder="Meta diaria de pasos"
                        />
                        <AppButton variant="ghost" onPress={saveGoal}>
                          Guardar meta
                        </AppButton>
                      </XStack>
                    </YStack>
                  )}
                </YStack>
              </AppCard>
            </TutorialTarget>
          ) : null}

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
      </TutorialScrollView>
    </YStack>
  );
}
