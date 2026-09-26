import { AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import type { GameTimeMetric } from '../../lib/analytics/types';
import { TrendChart } from './TrendChart';

interface GameTimePanelProps {
  metric: GameTimeMetric;
}

function formatMinutes(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

// Windows desktop counterpart of ScreenTimePanel.tsx -- populated from Steam/Riot Client/
// Battle.net process/registry detection (apps/desktop/src-tauri/src/game_tracking.rs), so this
// whole panel is absent on a web-only or mobile-only account.
export function GameTimePanel({ metric }: GameTimePanelProps) {
  if (!metric.hasData) return null;

  return (
    <YStack gap="$3">
      <AppCard>
        <YStack gap="$4">
          <YStack gap="$1">
            <H2 margin={0} fontSize="$6">
              Tiempo de juego
            </H2>
            <Paragraph color="$muted" margin={0}>
              Sincronizado desde la app de escritorio -- Steam (por juego), Riot Client y
              Battle.net.
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

          {metric.topGamesToday.length > 0 ? (
            <YStack gap="$2">
              <Paragraph margin={0} color="$muted">
                Jugado hoy
              </Paragraph>
              {metric.topGamesToday.slice(0, 5).map((game) => (
                <XStack key={game.key} justifyContent="space-between" paddingVertical="$1">
                  <Text fontSize="$3">{game.label}</Text>
                  <Text fontSize="$3" color="$muted">
                    {formatMinutes(game.minutes)}
                  </Text>
                </XStack>
              ))}
            </YStack>
          ) : null}
        </YStack>
      </AppCard>

      <TrendChart
        title="Tiempo de juego (14 dias)"
        description="Total diario en Steam, Riot Client y Battle.net."
        points={metric.byDay}
        formatValue={formatMinutes}
        color="$accent"
      />
    </YStack>
  );
}
