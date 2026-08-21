import { AppButton, AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { Stack as RouterStack } from 'expo-router';
import { ScrollView } from 'react-native';
import { MetricCard } from '../components/dashboard/MetricCard';
import { TutorialTarget } from '../components/onboarding/TutorialTarget';
import { useOnboarding } from '../context/OnboardingContext';
import { useDashboard } from '../hooks/useDashboard';

const DIFFICULTY_LABELS = { EASY: 'Faciles', MEDIUM: 'Medias', HARD: 'Dificiles' } as const;

function translateTendency(tendency: 'underestimate' | 'overestimate' | 'balanced') {
  if (tendency === 'underestimate') return 'subestimacion';
  if (tendency === 'overestimate') return 'sobreestimacion';
  return 'balanceado';
}

/**
 * Fifth slice of task 6.2 -- the last reasonable one before 6.2 is considered "closed" at its
 * current scope (full drag-and-drop calendar grid, native OAuth/notifications/date-picker are
 * separate work from here). Ports apps/web's DashboardPage.tsx: same buildDashboardMetrics()
 * orchestrator (packages/shared analytics functions underneath, all pure), same "hand-rolled
 * bars, no charting library" visual approach web already uses (confirmed: no recharts/victory/
 * etc dependency anywhere in this repo) -- so the 14-day focus-hours bars port with the same
 * technique, not a simplification. Suggestions are dropped: apps/web's own dashboard page never
 * renders them either.
 */
export default function DashboardScreen() {
  const { metrics, isLoading, error } = useDashboard();
  const { startTour } = useOnboarding();

  return (
    <YStack flex={1} backgroundColor="$background">
      <RouterStack.Screen
        options={{
          title: 'Dashboard',
          headerShown: true,
          headerStyle: { backgroundColor: '#212e28' },
          headerTintColor: '#f2f7f4',
          headerRight: () => (
            <AppButton variant="ghost" paddingHorizontal="$2" onPress={() => startTour('dashboard')}>
              ?
            </AppButton>
          ),
        }}
      />

      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <YStack width="100%" maxWidth={560} alignSelf="center" padding="$6" gap="$5">
          {error ? (
            <Text color="$danger" fontSize="$3">
              {error}
            </Text>
          ) : null}

          {isLoading || !metrics ? (
            <Paragraph color="$muted">Cargando...</Paragraph>
          ) : !metrics.hasData ? (
            <AppCard>
              <Paragraph margin={0} color="$muted">
                Todavia no hay suficientes datos para mostrar estadisticas.
              </Paragraph>
            </AppCard>
          ) : (
            <>
              <TutorialTarget id="dashboard-metrics">
                <XStack gap="$3" flexWrap="wrap">
                  <MetricCard
                    title="Tareas completadas (semana)"
                    value={String(metrics.tasksCompleted.current)}
                    subtitle={`${metrics.tasksCompleted.delta >= 0 ? '+' : ''}${metrics.tasksCompleted.delta} vs semana pasada`}
                  />
                  <MetricCard
                    title="Pomodoros completados"
                    value={String(metrics.pomodorosCompleted.current)}
                    subtitle={`${metrics.pomodorosCompleted.delta >= 0 ? '+' : ''}${metrics.pomodorosCompleted.delta} vs semana pasada`}
                  />
                  <MetricCard
                    title="Horas de enfoque"
                    value={String(metrics.focusHours.current)}
                    subtitle={`${metrics.focusHours.delta >= 0 ? '+' : ''}${metrics.focusHours.delta} vs semana pasada`}
                  />
                </XStack>
              </TutorialTarget>

              <AppCard>
                <YStack gap="$4">
                  <H2 margin={0} fontSize="$6">
                    Estimado vs real
                  </H2>

                  <XStack gap="$4" flexWrap="wrap">
                    <YStack minWidth={100} flex={1} gap="$1">
                      <Paragraph margin={0} color="$muted" fontSize="$2">
                        Estimado
                      </Paragraph>
                      <Text fontSize="$7" fontWeight="700">
                        {metrics.estimatedVsActual.estimatedMinutes} min
                      </Text>
                    </YStack>
                    <YStack minWidth={100} flex={1} gap="$1">
                      <Paragraph margin={0} color="$muted" fontSize="$2">
                        Real
                      </Paragraph>
                      <Text fontSize="$7" fontWeight="700">
                        {metrics.estimatedVsActual.actualMinutes} min
                      </Text>
                    </YStack>
                    <YStack minWidth={100} flex={1} gap="$1">
                      <Paragraph margin={0} color="$muted" fontSize="$2">
                        Variacion
                      </Paragraph>
                      <Text fontSize="$7" fontWeight="700" color={metrics.estimatedVsActual.varianceMinutes > 0 ? '$danger' : '$accent'}>
                        {metrics.estimatedVsActual.varianceMinutes > 0 ? '+' : ''}
                        {metrics.estimatedVsActual.varianceMinutes} min
                      </Text>
                    </YStack>
                  </XStack>

                  <YStack gap="$2">
                    <Paragraph margin={0}>Precision por dificultad</Paragraph>
                    {(['EASY', 'MEDIUM', 'HARD'] as const).map((difficulty) => {
                      const item = metrics.estimationAccuracy.byDifficulty[difficulty];
                      return (
                        <XStack key={difficulty} justifyContent="space-between" gap="$2" paddingVertical="$1">
                          <Text fontSize="$3">{DIFFICULTY_LABELS[difficulty]}</Text>
                          <Text color="$muted" fontSize="$2">
                            {item.count} tareas · error {item.avgErrorPct}% · {translateTendency(item.tendency)}
                          </Text>
                        </XStack>
                      );
                    })}
                  </YStack>
                </YStack>
              </AppCard>

              <TutorialTarget id="dashboard-focus-chart">
                <AppCard>
                  <YStack gap="$4">
                    <H2 margin={0} fontSize="$6">
                      Enfoque por dia (14 dias)
                    </H2>
                    <XStack alignItems="flex-end" gap="$1" height={100}>
                      {metrics.focusByDay.map((point) => {
                        const maxHours = Math.max(1, ...metrics.focusByDay.map((entry) => entry.focusHours));
                        const heightPct = Math.max(4, (point.focusHours / maxHours) * 100);
                        return (
                          <YStack key={point.date} flex={1} alignItems="center" gap="$1">
                            <YStack width="100%" height={80} justifyContent="flex-end">
                              <YStack width="100%" height={`${heightPct}%`} backgroundColor="$accent" borderRadius={4} />
                            </YStack>
                            <Text fontSize={9} color="$muted">
                              {point.label.slice(0, 2)}
                            </Text>
                          </YStack>
                        );
                      })}
                    </XStack>
                  </YStack>
                </AppCard>
              </TutorialTarget>

              <AppCard>
                <YStack gap="$3">
                  <H2 margin={0} fontSize="$6">
                    Completado por dificultad
                  </H2>
                  {metrics.completionByDifficulty.map((item) => (
                    <YStack key={item.difficulty} gap="$1">
                      <XStack justifyContent="space-between">
                        <Text fontSize="$3">{DIFFICULTY_LABELS[item.difficulty]}</Text>
                        <Text color="$muted" fontSize="$2">
                          {item.completed}/{item.total} · {item.completionRate}%
                        </Text>
                      </XStack>
                      <YStack width="100%" height={8} backgroundColor="$overlaySubtle" borderRadius={4}>
                        <YStack width={`${item.completionRate}%`} height={8} backgroundColor="$accent" borderRadius={4} />
                      </YStack>
                    </YStack>
                  ))}
                </YStack>
              </AppCard>

              <AppCard>
                <YStack gap="$2">
                  <H2 margin={0} fontSize="$6">
                    Fitness y productividad
                  </H2>
                  <Paragraph margin={0} color="$muted">
                    {metrics.fitnessCorrelation.message}
                  </Paragraph>
                </YStack>
              </AppCard>
            </>
          )}
        </YStack>
      </ScrollView>
    </YStack>
  );
}
