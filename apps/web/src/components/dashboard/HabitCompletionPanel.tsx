import { AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import type { HabitCompletionMetric } from '../../lib/analytics/types';

interface HabitCompletionPanelProps {
  metric: HabitCompletionMetric;
}

// Task 8.5. Same "stat row" shape as WeekComparisonPanel's ComparisonItem, but for the three
// habit numbers that don't fit a week-over-week comparison (a streak and a today-count aren't
// "this week vs last week" data).
export function HabitCompletionPanel({ metric }: HabitCompletionPanelProps) {
  if (!metric.hasData) return null;

  return (
    <AppCard>
      <YStack gap="$4">
        <YStack gap="$1">
          <H2 margin={0} fontSize="$6">
            Habitos
          </H2>
          <Paragraph color="$muted" margin={0}>
            Cumplimiento y racha actual -- sincronizado desde el celular.
          </Paragraph>
        </YStack>

        <XStack gap="$3" flexWrap="wrap">
          <Stat label="Habitos activos" value={`${metric.activeHabitCount}`} />
          <Stat label="Cumplidos hoy" value={`${metric.completedToday}`} />
          <Stat label="Racha actual" value={`${metric.currentStreak} dia${metric.currentStreak === 1 ? '' : 's'}`} />
        </XStack>
      </YStack>
    </AppCard>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
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
