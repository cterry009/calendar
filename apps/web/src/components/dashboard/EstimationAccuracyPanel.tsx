import { AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import type { EstimationAccuracyReport } from '@calendar/shared';
import type { EstimatedVsActualMetric } from '../../lib/analytics/types';

interface EstimationAccuracyPanelProps {
  estimationAccuracy: EstimationAccuracyReport;
  estimatedVsActual: EstimatedVsActualMetric;
}

const LABELS = {
  EASY: 'Faciles',
  MEDIUM: 'Medias',
  HARD: 'Dificiles',
} as const;

export function EstimationAccuracyPanel({ estimationAccuracy, estimatedVsActual }: EstimationAccuracyPanelProps) {
  const varianceColor = estimatedVsActual.varianceMinutes > 0 ? '$error' : '$accent';

  return (
    <AppCard>
      <YStack gap="$4">
        <YStack gap="$1">
          <H2 margin={0} fontSize="$6">
            Estimado vs real
          </H2>
          <Paragraph color="$muted" margin={0}>
            Diferencia total y precision por dificultad.
          </Paragraph>
        </YStack>

        <XStack gap="$4" flexWrap="wrap">
          <YStack minWidth={220} flex={1} gap="$1">
            <Paragraph margin={0} color="$muted">
              Tiempo estimado
            </Paragraph>
            <Text fontSize="$8" fontWeight="700">
              {estimatedVsActual.estimatedMinutes} min
            </Text>
          </YStack>
          <YStack minWidth={220} flex={1} gap="$1">
            <Paragraph margin={0} color="$muted">
              Tiempo real
            </Paragraph>
            <Text fontSize="$8" fontWeight="700">
              {estimatedVsActual.actualMinutes} min
            </Text>
          </YStack>
          <YStack minWidth={220} flex={1} gap="$1">
            <Paragraph margin={0} color="$muted">
              Variacion
            </Paragraph>
            <Text fontSize="$8" fontWeight="700" color={varianceColor}>
              {estimatedVsActual.varianceMinutes > 0 ? '+' : ''}
              {estimatedVsActual.varianceMinutes} min
            </Text>
            <Text color="$muted" fontSize="$2">
              {estimatedVsActual.variancePct > 0 ? '+' : ''}
              {estimatedVsActual.variancePct}%
            </Text>
          </YStack>
        </XStack>

        <YStack gap="$2">
          <Paragraph margin={0}>Precision por dificultad</Paragraph>
          {(['EASY', 'MEDIUM', 'HARD'] as const).map((difficulty) => {
            const item = estimationAccuracy.byDifficulty[difficulty];
            return (
              <XStack
                key={difficulty}
                alignItems="center"
                justifyContent="space-between"
                gap="$2"
                padding="$2"
                borderRadius="$3"
                backgroundColor="rgba(255,255,255,0.03)"
              >
                <Text>{LABELS[difficulty]}</Text>
                <Text color="$muted">
                  {item.count} tareas · error medio {item.avgErrorPct}% · {translateTendency(item.tendency)}
                </Text>
              </XStack>
            );
          })}
        </YStack>
      </YStack>
    </AppCard>
  );
}

function translateTendency(tendency: 'underestimate' | 'overestimate' | 'balanced') {
  if (tendency === 'underestimate') {
    return 'subestimacion';
  }
  if (tendency === 'overestimate') {
    return 'sobreestimacion';
  }
  return 'balanceado';
}
