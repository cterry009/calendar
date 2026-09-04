import { AppButton, H2, Paragraph, XStack, YStack } from '@calendar/ui';
import { BlockEventsPanel } from '../components/dashboard/BlockEventsPanel';
import { CompletionByDifficultyPanel } from '../components/dashboard/CompletionByDifficultyPanel';
import { DeviceSensorsPanel } from '../components/dashboard/DeviceSensorsPanel';
import { EstimationAccuracyPanel } from '../components/dashboard/EstimationAccuracyPanel';
import { FitnessCorrelationPanel } from '../components/dashboard/FitnessCorrelationPanel';
import { FocusHoursChart } from '../components/dashboard/FocusHoursChart';
import { HabitCompletionPanel } from '../components/dashboard/HabitCompletionPanel';
import { MetricCard } from '../components/dashboard/MetricCard';
import { ScreenTimePanel } from '../components/dashboard/ScreenTimePanel';
import { WeekComparisonPanel } from '../components/dashboard/WeekComparisonPanel';
import { PageHeader } from '../components/PageHeader';
import { StatusCard } from '../components/StatusCard';
import { usePanel } from '../context/PanelContext';
import { useDashboard } from '../hooks/useDashboard';
import type { DashboardMetrics } from '../lib/analytics/types';

// Task 8.5: independent of DashboardMetrics.hasData (tasks/pomodoros/fitness) -- a mobile-only
// account can have real habit/sensor/blocking/screen-time data while never having touched web's
// tasks or pomodoro timer, and should still see it here.
function hasCrossPlatformData(metrics: DashboardMetrics): boolean {
  return metrics.habitCompletion.hasData || metrics.deviceSensors.hasData || metrics.blockEvents.hasData || metrics.screenTime.hasData;
}

export function DashboardPage() {
  const { openPanel } = usePanel();
  const { metrics, isLoading, isSeeding, error, syncedAt, refetch, seedDemo } = useDashboard();

  const isEmpty = !isLoading && metrics && !metrics.hasData && !hasCrossPlatformData(metrics);

  async function handleSeedDemo() {
    await seedDemo();
  }

  return (
    <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$7" gap="$5">
      <PageHeader
        eyebrow="Analitica"
        title="Dashboard de productividad"
        description="Revisa rendimiento semanal, precision de estimaciones, foco diario y correlacion con fitness."
        actions={
          <>
            <AppButton type="button" variant="primary" onPress={() => void handleSeedDemo()} disabled={isLoading || isSeeding}>
              {isSeeding ? 'Generando datos...' : 'Generar datos de ejemplo'}
            </AppButton>
            <AppButton type="button" variant="ghost" onPress={() => void refetch()} disabled={isLoading || isSeeding}>
              {isLoading ? 'Cargando...' : 'Refrescar'}
            </AppButton>
          </>
        }
      />

      {error ? <StatusCard tone="error" message={error} /> : null}

      {isLoading ? <StatusCard tone="loading" message="Cargando dashboard..." /> : null}

      {isEmpty ? (
        <StatusCard
          message="Todavia no hay datos para mostrar el dashboard."
          detail="Genera datos de ejemplo para visualizar metricas semanales y graficas sin cargar datos manuales."
        />
      ) : null}

      {!isLoading && metrics && metrics.hasData ? (
        <YStack gap="$5">
          <XStack gap="$3" flexWrap="wrap">
            <MetricCard
              title="Tareas (semana actual)"
              value={`${metrics.tasksCompleted.current}`}
              subtitle={`Semana pasada: ${metrics.tasksCompleted.previous}`}
              tone={metrics.tasksCompleted.delta >= 0 ? 'accent' : 'danger'}
            />
            <MetricCard
              title="Pomodoros (semana actual)"
              value={`${metrics.pomodorosCompleted.current}`}
              subtitle={`Semana pasada: ${metrics.pomodorosCompleted.previous}`}
              tone={metrics.pomodorosCompleted.delta >= 0 ? 'accent' : 'danger'}
            />
            <MetricCard
              title="Horas de foco (semana actual)"
              value={`${metrics.focusHours.current}h`}
              subtitle={`Semana pasada: ${metrics.focusHours.previous}h`}
              tone={metrics.focusHours.delta >= 0 ? 'accent' : 'danger'}
            />
          </XStack>

          <WeekComparisonPanel
            tasks={metrics.tasksCompleted}
            pomodoros={metrics.pomodorosCompleted}
            focusHours={metrics.focusHours}
          />

          <EstimationAccuracyPanel
            estimationAccuracy={metrics.estimationAccuracy}
            estimatedVsActual={metrics.estimatedVsActual}
          />

          <XStack gap="$5" flexWrap="wrap" alignItems="stretch">
            <YStack flex={1.4} minWidth={380}>
              <FocusHoursChart points={metrics.focusByDay} />
            </YStack>
            <YStack flex={1} minWidth={320} gap="$5">
              <CompletionByDifficultyPanel items={metrics.completionByDifficulty} />
              <FitnessCorrelationPanel
                report={metrics.fitnessCorrelation}
                onOpenSuggestions={() => openPanel('suggestions')}
              />
            </YStack>
          </XStack>
        </YStack>
      ) : null}

      {!isLoading && metrics && hasCrossPlatformData(metrics) ? (
        <YStack gap="$5">
          <YStack gap="$1">
            <H2 margin={0} fontSize="$6">
              Multiplataforma
            </H2>
            <Paragraph color="$muted" margin={0}>
              Datos que solo el celular puede recolectar (sensores, bloqueo real, tiempo de
              pantalla) -- se muestran aca aunque nunca hayas usado tareas o pomodoros en la web.
            </Paragraph>
          </YStack>

          <HabitCompletionPanel metric={metrics.habitCompletion} />
          <DeviceSensorsPanel metric={metrics.deviceSensors} />
          <BlockEventsPanel metric={metrics.blockEvents} />
          <ScreenTimePanel metric={metrics.screenTime} />
        </YStack>
      ) : null}

      {syncedAt ? (
        <Paragraph size="$2" color="$muted" margin={0}>
          Ultima sincronizacion: {new Date(syncedAt).toLocaleString('es-ES')}
        </Paragraph>
      ) : null}
    </YStack>
  );
}
