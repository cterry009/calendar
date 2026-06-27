import { AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import type { DashboardWeekMetric } from '../../lib/analytics/types';

interface WeekComparisonPanelProps {
  tasks: DashboardWeekMetric;
  pomodoros: DashboardWeekMetric;
  focusHours: DashboardWeekMetric;
}

export function WeekComparisonPanel({ tasks, pomodoros, focusHours }: WeekComparisonPanelProps) {
  return (
    <AppCard>
      <YStack gap="$4">
        <YStack gap="$1">
          <H2 margin={0} fontSize="$6">
            Semana actual vs semana pasada
          </H2>
          <Paragraph color="$muted" margin={0}>
            Comparativa de tareas, pomodoros y horas de foco.
          </Paragraph>
        </YStack>

        <XStack gap="$3" flexWrap="wrap">
          <ComparisonItem label="Tareas completadas" metric={tasks} />
          <ComparisonItem label="Pomodoros completados" metric={pomodoros} />
          <ComparisonItem label="Horas de foco" metric={focusHours} />
        </XStack>
      </YStack>
    </AppCard>
  );
}

function ComparisonItem({ label, metric }: { label: string; metric: DashboardWeekMetric }) {
  const trendColor = metric.delta >= 0 ? '$accent' : '$error';
  const trendSign = metric.delta > 0 ? '+' : '';

  return (
    <YStack
      minWidth={220}
      flex={1}
      gap="$1"
      padding="$3"
      borderRadius="$3"
      backgroundColor="rgba(255,255,255,0.03)"
    >
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
