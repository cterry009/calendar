import { AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { buildWeeklySummary } from '../../lib/fitness/summary';
import type { SyncFitnessRecord } from '../../lib/fitness/types';

interface WeeklyFitnessSummaryProps {
  entries: SyncFitnessRecord[];
  referenceDate: Date;
}

function formatMinutes(minutes: number): string {
  return `${minutes} min`;
}

export function WeeklyFitnessSummary({ entries, referenceDate }: WeeklyFitnessSummaryProps) {
  const summary = buildWeeklySummary(entries, referenceDate);
  const maxMinutes = Math.max(1, ...summary.daily.map((day) => day.totalMinutes));

  return (
    <AppCard>
      <YStack gap="$4">
        <YStack gap="$1">
          <H2 margin={0} fontSize="$6">
            Resumen semanal fitness
          </H2>
          <Paragraph color="$muted" margin={0}>
            {summary.weekStart.toLocaleDateString('es-ES')} - {summary.weekEnd.toLocaleDateString('es-ES')}
          </Paragraph>
        </YStack>

        <XStack gap="$3" flexWrap="wrap">
          <YStack
            minWidth={180}
            flex={1}
            padding="$3"
            borderRadius="$3"
            backgroundColor="rgba(255,255,255,0.03)"
            gap="$1"
          >
            <Text color="$muted" fontSize="$2">
              Minutos totales
            </Text>
            <Text fontSize="$8" fontWeight="700">
              {summary.totalMinutes}
            </Text>
          </YStack>

          <YStack
            minWidth={180}
            flex={1}
            padding="$3"
            borderRadius="$3"
            backgroundColor="rgba(255,255,255,0.03)"
            gap="$1"
          >
            <Text color="$muted" fontSize="$2">
              Sesiones
            </Text>
            <Text fontSize="$8" fontWeight="700">
              {summary.sessionCount}
            </Text>
          </YStack>
        </XStack>

        <YStack gap="$2">
          <Paragraph margin={0}>Desglose por actividad</Paragraph>
          {summary.activityBreakdown.length === 0 ? (
            <Paragraph color="$muted" margin={0}>
              Sin actividad en esta semana.
            </Paragraph>
          ) : (
            <YStack gap="$2">
              {summary.activityBreakdown.map((item) => (
                <XStack key={item.activityType} justifyContent="space-between" alignItems="center" gap="$2">
                  <Text>{item.activityType}</Text>
                  <Text color="$muted">
                    {item.sessionCount} sesiones - {formatMinutes(item.totalMinutes)}
                  </Text>
                </XStack>
              ))}
            </YStack>
          )}
        </YStack>

        <YStack gap="$2">
          <Paragraph margin={0}>Minutos por dia (lunes a domingo)</Paragraph>
          <XStack gap="$2" flexWrap="wrap">
            {summary.daily.map((day) => {
              const height = Math.round((day.totalMinutes / maxMinutes) * 90);
              return (
                <YStack key={day.date.toISOString()} width={58} alignItems="center" gap="$2">
                  <YStack
                    width="100%"
                    height={96}
                    justifyContent="flex-end"
                    alignItems="center"
                    backgroundColor="rgba(255,255,255,0.03)"
                    borderRadius="$2"
                    padding="$1"
                  >
                    <YStack
                      width="100%"
                      height={Math.max(2, height)}
                      borderRadius="$2"
                      backgroundColor="$accent"
                    />
                  </YStack>
                  <Text fontSize="$2" color="$muted" textAlign="center" textTransform="capitalize">
                    {day.date.toLocaleDateString('es-ES', { weekday: 'short' })}
                  </Text>
                  <Text fontSize="$2" color="$muted" textAlign="center">
                    {day.totalMinutes}m
                  </Text>
                </YStack>
              );
            })}
          </XStack>
        </YStack>
      </YStack>
    </AppCard>
  );
}
