import { AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import type { BlockEventMetric, DashboardWeekMetric } from '../../lib/analytics/types';
import { TrendChart } from './TrendChart';

interface BlockEventsPanelProps {
  metric: BlockEventMetric;
}

// Task 8.5. The metric the user explicitly asked for ("las veces que se bloquean/desbloquean
// apps") -- only ever populated from a mobile device's AccessibilityService (task 8.2), so this
// whole panel is absent for a web-only account.
export function BlockEventsPanel({ metric }: BlockEventsPanelProps) {
  if (!metric.hasData) return null;

  return (
    <YStack gap="$3">
      <AppCard>
        <YStack gap="$4">
          <YStack gap="$1">
            <H2 margin={0} fontSize="$6">
              Bloqueo real
            </H2>
            <Paragraph color="$muted" margin={0}>
              Cuantas veces se bloqueo un intento de abrir una app, y cuantas veces te desbloqueaste
              de la lista nocturna trotando o caminando.
            </Paragraph>
          </YStack>

          <XStack gap="$3" flexWrap="wrap">
            <ComparisonItem label="Intentos bloqueados" metric={metric.blockedAttempts} />
            <ComparisonItem label="Desbloqueos (trote/pasos)" metric={metric.nightUnlocks} />
          </XStack>
        </YStack>
      </AppCard>

      <TrendChart
        title="Intentos bloqueados (14 dias)"
        description="Veces que abriste una app de tu lista mientras estaba bloqueada."
        points={metric.blockedByDay}
        color="$danger"
      />
    </YStack>
  );
}

function ComparisonItem({ label, metric }: { label: string; metric: DashboardWeekMetric }) {
  const trendColor = metric.delta >= 0 ? '$accent' : '$error';
  const trendSign = metric.delta > 0 ? '+' : '';

  return (
    <YStack minWidth={220} flex={1} gap="$1" padding="$3" borderRadius="$3" backgroundColor="rgba(255,255,255,0.03)">
      <Paragraph margin={0} color="$muted">
        {label}
      </Paragraph>
      <Text fontSize="$9" fontWeight="700">
        {metric.current}
      </Text>
      <Text color="$muted" fontSize="$2">
        Semana pasada: {metric.previous}
      </Text>
      <Text color={trendColor} fontSize="$3">
        {trendSign}
        {metric.delta} ({trendSign}
        {metric.deltaPct}%)
      </Text>
    </YStack>
  );
}
