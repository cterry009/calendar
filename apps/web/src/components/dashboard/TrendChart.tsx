import { AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import type { DashboardTrendPoint } from '../../lib/analytics/types';

interface TrendChartProps {
  title: string;
  description: string;
  points: DashboardTrendPoint[];
  formatValue?: (value: number) => string;
  color?: string;
}

// Task 8.5. Generalizes FocusHoursChart's hand-rolled bar-chart technique (no charting library,
// confirmed absent from apps/web's dependencies back in task 6.2) into a reusable component --
// steps/floors/block-events/screen-time all need the identical 14-day bar shape, just with a
// different unit and color, so this factors it out instead of copy-pasting FocusHoursChart four
// more times. FocusHoursChart itself is left as-is (a working, already-shipped component) rather
// than migrated onto this, out of scope for this task.
export function TrendChart({ title, description, points, formatValue = (value) => `${value}`, color = '$accent' }: TrendChartProps) {
  const maxValue = Math.max(0.5, ...points.map((point) => point.value));

  return (
    <AppCard>
      <YStack gap="$4">
        <YStack gap="$1">
          <H2 margin={0} fontSize="$6">
            {title}
          </H2>
          <Paragraph color="$muted" margin={0}>
            {description}
          </Paragraph>
        </YStack>

        <XStack gap="$2" flexWrap="wrap">
          {points.map((point) => {
            const height = Math.round((point.value / maxValue) * 96);
            return (
              <YStack key={point.date} width={52} alignItems="center" gap="$2">
                <YStack
                  width="100%"
                  height={104}
                  borderRadius="$2"
                  backgroundColor="rgba(255,255,255,0.03)"
                  justifyContent="flex-end"
                  padding="$1"
                >
                  <YStack width="100%" height={Math.max(2, height)} borderRadius="$2" backgroundColor={color} />
                </YStack>
                <Text color="$muted" fontSize="$2" textTransform="capitalize">
                  {point.label}
                </Text>
                <Text color="$muted" fontSize="$2">
                  {formatValue(point.value)}
                </Text>
              </YStack>
            );
          })}
        </XStack>
      </YStack>
    </AppCard>
  );
}
