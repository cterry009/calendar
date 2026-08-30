import { AppButton, AppCard, Eyebrow, H1, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { Stack } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { TutorialScrollView } from '../components/onboarding/TutorialScrollView';
import { TutorialTarget } from '../components/onboarding/TutorialTarget';
import { useOnboarding } from '../context/OnboardingContext';
import { useInstalledApps } from '../hooks/useInstalledApps';
import { useScreenTime } from '../hooks/useScreenTime';
import type { AppUsageRecord } from '../lib/screenTime/api';

const MAX_ROWS = 10;

function formatDuration(totalTimeMs: number): string {
  const totalMinutes = Math.round(totalTimeMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function UsageList({ records, labels }: { records: AppUsageRecord[]; labels: Map<string, string> }) {
  if (records.length === 0) {
    return (
      <Paragraph margin={0} color="$muted">
        Sin datos todavia.
      </Paragraph>
    );
  }

  return (
    <YStack gap="$2">
      {records.slice(0, MAX_ROWS).map((record) => (
        <XStack key={record.packageName} justifyContent="space-between" gap="$3">
          <Text flex={1} numberOfLines={1}>
            {labels.get(record.packageName) ?? record.packageName}
          </Text>
          <Text color="$muted">{formatDuration(record.totalTimeMs)}</Text>
        </XStack>
      ))}
    </YStack>
  );
}

/**
 * Task 11.17. Android-only "most used apps" screen backed by UsageStatsManager (see
 * modules/screen-time). Deliberately local/device-only, not synced -- a phone's own foreground-app
 * history isn't meaningful to merge with another device's, unlike step counts or fitness entries.
 */
export default function ScreenTimeScreen() {
  const { startTour } = useOnboarding();
  const screenTime = useScreenTime();
  // Labels make this list actually useful (raw package names are hard to scan) -- auto-loaded
  // here, unlike blocklist.tsx's load-on-demand button, since this screen's whole purpose is
  // showing readable app names, not picking apps to block.
  const installedApps = useInstalledApps();

  useEffect(() => {
    if (installedApps.isSupported) void installedApps.load();
  }, []);

  const labels = useMemo(() => {
    const map = new Map<string, string>();
    for (const app of installedApps.apps) map.set(app.packageName, app.label);
    return map;
  }, [installedApps.apps]);

  // Installed-apps enumeration is noticeably slower than the usage-stats query -- without this,
  // the list renders raw package names first and swaps in real labels a few seconds later, a
  // visible flash confirmed on-device. Folding installedApps' own loading state into this
  // screen's "Cargando..." keeps the list from ever showing an unresolved package name.
  const isLoading = screenTime.isLoading || (installedApps.isSupported && !installedApps.isLoaded);

  return (
    <YStack flex={1} backgroundColor="$background">
      <Stack.Screen
        options={{
          title: 'Tiempo de pantalla',
          headerShown: true,
          headerStyle: { backgroundColor: '#212e28' },
          headerTintColor: '#f2f7f4',
          headerRight: () => (
            <AppButton variant="ghost" paddingHorizontal="$2" onPress={() => startTour('screen-time')}>
              ?
            </AppButton>
          ),
        }}
      />

      <TutorialScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <YStack width="100%" maxWidth={560} alignSelf="center" padding="$6" gap="$5">
          <YStack gap="$1">
            <Eyebrow>Bienestar</Eyebrow>
            <H1 marginTop={0} marginBottom={0}>
              Tiempo de pantalla
            </H1>
          </YStack>

          {!screenTime.isSupported ? (
            <AppCard>
              <Paragraph margin={0} color="$muted">
                El tiempo de uso por app solo esta disponible en Android.
              </Paragraph>
            </AppCard>
          ) : screenTime.hasAccess === null ? (
            <AppCard>
              <Paragraph margin={0} color="$muted">
                Cargando...
              </Paragraph>
            </AppCard>
          ) : screenTime.hasAccess === false ? (
            <TutorialTarget id="screen-time-access">
              <AppCard>
                <YStack gap="$2">
                  <Text fontWeight="700">Acceso a datos de uso</Text>
                  <Paragraph margin={0} color="$muted">
                    Para ver cuanto tiempo usas cada app, activa el permiso "Acceso a datos de uso"
                    en Ajustes de Android para Calendar Productivity.
                  </Paragraph>
                  <AppButton variant="primary" onPress={screenTime.requestAccess}>
                    Abrir Ajustes
                  </AppButton>
                  <AppButton variant="ghost" onPress={screenTime.refresh}>
                    Ya lo active, actualizar
                  </AppButton>
                </YStack>
              </AppCard>
            </TutorialTarget>
          ) : (
            <>
              {screenTime.error ? (
                <Text color="$danger" fontSize="$3">
                  {screenTime.error}
                </Text>
              ) : null}

              <TutorialTarget id="screen-time-today">
                <AppCard>
                  <YStack gap="$3">
                    <Text fontWeight="700">Hoy</Text>
                    {isLoading ? (
                      <Paragraph margin={0} color="$muted">
                        Cargando...
                      </Paragraph>
                    ) : (
                      <UsageList records={screenTime.todayUsage} labels={labels} />
                    )}
                  </YStack>
                </AppCard>
              </TutorialTarget>

              <TutorialTarget id="screen-time-week">
                <AppCard>
                  <YStack gap="$3">
                    <Text fontWeight="700">Apps mas usadas (ultimos 7 dias)</Text>
                    {isLoading ? (
                      <Paragraph margin={0} color="$muted">
                        Cargando...
                      </Paragraph>
                    ) : (
                      <UsageList records={screenTime.weekUsage} labels={labels} />
                    )}
                  </YStack>
                </AppCard>
              </TutorialTarget>

              <AppButton variant="ghost" onPress={screenTime.refresh}>
                Actualizar
              </AppButton>
            </>
          )}
        </YStack>
      </TutorialScrollView>
    </YStack>
  );
}
