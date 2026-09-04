import { AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import type { ScreenTimeMetric } from '../../lib/analytics/types';
import { TrendChart } from './TrendChart';

interface ScreenTimePanelProps {
  metric: ScreenTimeMetric;
}

function formatMinutes(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

// Task 8.5. Reverses task 11.18's original "screen time never leaves the device" decision (see
// task 8.3) -- only ever populated from Android's UsageStatsManager, so this whole panel is
// absent for a web-only account.
export function ScreenTimePanel({ metric }: ScreenTimePanelProps) {
  if (!metric.hasData) return null;

  return (
    <YStack gap="$3">
      <AppCard>
        <YStack gap="$4">
          <YStack gap="$1">
            <H2 margin={0} fontSize="$6">
              Tiempo de pantalla
            </H2>
            <Paragraph color="$muted" margin={0}>
              Sincronizado desde el celular -- resumen diario, no un registro de cada apertura.
            </Paragraph>
          </YStack>

          <XStack gap="$3" flexWrap="wrap">
            <YStack minWidth={180} flex={1} gap="$1" padding="$3" borderRadius="$3" backgroundColor="rgba(255,255,255,0.03)">
              <Paragraph margin={0} color="$muted">
                Hoy
              </Paragraph>
              <Text fontSize="$9" fontWeight="700">
                {formatMinutes(metric.todayMinutes)}
              </Text>
            </YStack>
            <YStack minWidth={180} flex={1} gap="$1" padding="$3" borderRadius="$3" backgroundColor="rgba(255,255,255,0.03)">
              <Paragraph margin={0} color="$muted">
                Promedio (7 dias)
              </Paragraph>
              <Text fontSize="$9" fontWeight="700">
                {formatMinutes(metric.weekAverageMinutes)}
              </Text>
            </YStack>
          </XStack>

          {metric.topAppsToday.length > 0 ? (
            <YStack gap="$2">
              <Paragraph margin={0} color="$muted">
                Mas usadas hoy
              </Paragraph>
              {metric.topAppsToday.slice(0, 5).map((app) => (
                <XStack key={app.packageName} justifyContent="space-between" paddingVertical="$1">
                  <Text fontSize="$3">{app.packageName}</Text>
                  <Text fontSize="$3" color="$muted">
                    {formatMinutes(app.minutes)}
                  </Text>
                </XStack>
              ))}
            </YStack>
          ) : null}
        </YStack>
      </AppCard>

      <TrendChart
        title="Tiempo de pantalla (14 dias)"
        description="Total diario de uso de apps."
        points={metric.byDay}
        formatValue={formatMinutes}
        color="$accent"
      />
    </YStack>
  );
}
