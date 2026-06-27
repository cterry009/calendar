import { AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import type { FocusByDayPoint } from '../../lib/analytics/types';

interface FocusHoursChartProps {
  points: FocusByDayPoint[];
}

export function FocusHoursChart({ points }: FocusHoursChartProps) {
  const maxHours = Math.max(0.5, ...points.map((point) => point.focusHours));

  return (
    <AppCard>
      <YStack gap="$4">
        <YStack gap="$1">
          <H2 margin={0} fontSize="$6">
            Horas de foco (14 dias)
          </H2>
          <Paragraph color="$muted" margin={0}>
            Barra diaria de foco usando datos de sesiones pomodoro finalizadas.
          </Paragraph>
        </YStack>

        <XStack gap="$2" flexWrap="wrap">
          {points.map((point) => {
            const height = Math.round((point.focusHours / maxHours) * 96);
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
                  <YStack width="100%" height={Math.max(2, height)} borderRadius="$2" backgroundColor="$accent" />
                </YStack>
                <Text color="$muted" fontSize="$2" textTransform="capitalize">
                  {point.label}
                </Text>
                <Text color="$muted" fontSize="$2">
                  {point.focusHours}h
                </Text>
              </YStack>
            );
          })}
        </XStack>
      </YStack>
    </AppCard>
  );
}
