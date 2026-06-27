import { useNavigate } from 'react-router-dom';
import { AppButton, AppCard, Eyebrow, H1, Paragraph, XStack, YStack } from '@calendar/ui';
import { CompletionByDifficultyPanel } from '../components/dashboard/CompletionByDifficultyPanel';
import { EstimationAccuracyPanel } from '../components/dashboard/EstimationAccuracyPanel';
import { FitnessCorrelationPanel } from '../components/dashboard/FitnessCorrelationPanel';
import { FocusHoursChart } from '../components/dashboard/FocusHoursChart';
import { MetricCard } from '../components/dashboard/MetricCard';
import { WeekComparisonPanel } from '../components/dashboard/WeekComparisonPanel';
import { useDashboard } from '../hooks/useDashboard';

export function DashboardPage() {
  const navigate = useNavigate();
  const { metrics, isLoading, isSeeding, error, syncedAt, refetch, seedDemo } = useDashboard();

  const isEmpty = !isLoading && metrics && !metrics.hasData;

  async function handleSeedDemo() {
    await seedDemo();
  }

  return (
    <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$7" gap="$5">
      <XStack justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap="$4">
        <YStack maxWidth={760}>
          <Eyebrow>Analitica</Eyebrow>
          <H1 marginTop={0} marginBottom="$2">
            Dashboard de productividad
          </H1>
          <Paragraph color="$muted" margin={0}>
            Revisa rendimiento semanal, precision de estimaciones, foco diario y correlacion con fitness.
          </Paragraph>
        </YStack>

        <XStack gap="$2" flexWrap="wrap">
          <AppButton type="button" variant="ghost" onPress={() => navigate('/tasks')}>
            Tareas
          </AppButton>
          <AppButton type="button" variant="ghost" onPress={() => navigate('/fitness')}>
            Fitness
          </AppButton>
          <AppButton type="button" variant="ghost" onPress={() => navigate('/suggestions')}>
            Sugerencias
          </AppButton>
          <AppButton type="button" variant="ghost" onPress={() => navigate('/')}>
            Inicio
          </AppButton>
        </XStack>
      </XStack>

      <XStack gap="$2" flexWrap="wrap">
        <AppButton type="button" variant="primary" onPress={() => void handleSeedDemo()} disabled={isLoading || isSeeding}>
          {isSeeding ? 'Generando datos...' : 'Generar datos de ejemplo'}
        </AppButton>
        <AppButton type="button" variant="ghost" onPress={() => void refetch()} disabled={isLoading || isSeeding}>
          {isLoading ? 'Cargando...' : 'Refrescar'}
        </AppButton>
      </XStack>

      {error ? (
        <AppCard>
          <Paragraph margin={0} color="$error">
            {error}
          </Paragraph>
        </AppCard>
      ) : null}

      {isLoading ? (
        <AppCard>
          <Paragraph margin={0}>Cargando dashboard...</Paragraph>
        </AppCard>
      ) : null}

      {isEmpty ? (
        <AppCard>
          <YStack gap="$3">
            <Paragraph margin={0}>Todavia no hay datos para mostrar el dashboard.</Paragraph>
            <Paragraph color="$muted" margin={0}>
              Genera datos de ejemplo para visualizar metricas semanales y graficas sin cargar datos manuales.
            </Paragraph>
          </YStack>
        </AppCard>
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
                onOpenSuggestions={() => navigate('/suggestions')}
              />
            </YStack>
          </XStack>
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
