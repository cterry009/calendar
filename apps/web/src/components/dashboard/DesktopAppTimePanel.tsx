import { useState } from 'react';
import { AppButton, AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { useDesktopAppTime } from '../../hooks/useDesktopAppTime';

const COLLAPSED_COUNT = 5;

function formatMinutes(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

// Per-app foreground time from the Windows desktop client
// (apps/desktop/src-tauri/src/app_tracking.rs). Renders nothing until that client has synced a
// day, so the panel is simply absent on a web-only or mobile-only account -- same treatment
// GameTimePanel gives its own desktop-sourced data.
//
// Shown separately from "Tiempo de juego" rather than combined: the two overlap by design (a game
// in the foreground counts in both), so a single merged total would double-count.
export function DesktopAppTimePanel() {
  const { todayUsage, totalMinutes, isLoading } = useDesktopAppTime();
  const [showAll, setShowAll] = useState(false);

  if (isLoading || todayUsage.length === 0) return null;

  const hiddenCount = todayUsage.length - COLLAPSED_COUNT;
  const visibleUsage = showAll ? todayUsage : todayUsage.slice(0, COLLAPSED_COUNT);

  return (
    <AppCard>
      <YStack gap="$4">
        <YStack gap="$1">
          <H2 margin={0} fontSize="$6">
            Tiempo por aplicacion
          </H2>
          <Paragraph color="$muted" margin={0}>
            Tiempo con cada app en primer plano hoy, desde la app de escritorio. No cuenta los
            ratos en que te alejaste de la computadora.
          </Paragraph>
        </YStack>

        <YStack
          gap="$1"
          padding="$3"
          borderRadius="$3"
          backgroundColor="rgba(255,255,255,0.03)"
        >
          <Paragraph margin={0} color="$muted">
            Total activo hoy
          </Paragraph>
          <Text fontSize="$9" fontWeight="700">
            {formatMinutes(totalMinutes)}
          </Text>
        </YStack>

        <YStack gap="$2">
          <Paragraph margin={0} color="$muted">
            Mas usadas
          </Paragraph>
          {visibleUsage.map((app) => (
            <XStack key={app.key} justifyContent="space-between" paddingVertical="$1">
              <Text fontSize="$3">{app.label}</Text>
              <Text fontSize="$3" color="$muted">
                {formatMinutes(app.minutes)}
              </Text>
            </XStack>
          ))}

          {hiddenCount > 0 ? (
            <AppButton variant="ghost" onPress={() => setShowAll((value) => !value)}>
              {showAll ? 'Ver menos' : `Ver todas las apps (${hiddenCount} mas)`}
            </AppButton>
          ) : null}
        </YStack>
      </YStack>
    </AppCard>
  );
}
