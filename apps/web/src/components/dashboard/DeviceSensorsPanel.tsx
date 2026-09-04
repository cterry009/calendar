import { Paragraph, Text, XStack, YStack } from '@calendar/ui';
import type { DeviceSensorMetric } from '../../lib/analytics/types';
import { TrendChart } from './TrendChart';

interface DeviceSensorsPanelProps {
  metric: DeviceSensorMetric;
}

// Task 8.5. Steps/floors only ever come from the mobile app's device sensors (tasks 10.6/10.8) --
// this whole panel is absent for a web-only account, same "no fake zero" contract every other
// hasData:false metric follows.
export function DeviceSensorsPanel({ metric }: DeviceSensorsPanelProps) {
  if (!metric.hasData) return null;

  return (
    <YStack gap="$3">
      <XStack gap="$3" flexWrap="wrap">
        <SummaryChip label="Pasos hoy" value={metric.todaySteps.toLocaleString('es-ES')} />
        <SummaryChip label="Pisos hoy" value={`${metric.todayFloors}`} />
      </XStack>
      <XStack gap="$5" flexWrap="wrap" alignItems="stretch">
        <YStack flex={1} minWidth={320}>
          <TrendChart title="Pasos (14 dias)" description="Total diario de pasos, sincronizado desde el celular." points={metric.stepsByDay} color="$accent" />
        </YStack>
        <YStack flex={1} minWidth={320}>
          <TrendChart title="Pisos subidos (14 dias)" description="Estimado a partir del barometro del celular." points={metric.floorsByDay} color="$accent" />
        </YStack>
      </XStack>
    </YStack>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <YStack minWidth={180} flex={1} gap="$1" padding="$3" borderRadius="$3" backgroundColor="rgba(255,255,255,0.03)">
      <Paragraph margin={0} color="$muted">
        {label}
      </Paragraph>
      <Text fontSize="$9" fontWeight="700">
        {value}
      </Text>
    </YStack>
  );
}
