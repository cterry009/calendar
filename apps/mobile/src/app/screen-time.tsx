import type { BlockListScope } from '@calendar/shared';
import { AppButton, AppCard, Eyebrow, H1, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { TutorialScrollView } from '../components/onboarding/TutorialScrollView';
import { TutorialTarget } from '../components/onboarding/TutorialTarget';
import { useOnboarding } from '../context/OnboardingContext';
import { useBlockList } from '../hooks/useBlockList';
import { useInstalledApps } from '../hooks/useInstalledApps';
import { useNightWindow } from '../hooks/useNightWindow';
import { useScreenTime } from '../hooks/useScreenTime';
import { formatNightWindowMinutes } from '../lib/nightBlock/state';
import type { AppUsageRecord } from '../lib/screenTime/api';
import { isKnownDistractingApp } from '../lib/screenTime/distractingApps';

const MAX_ROWS = 10;
const MAX_SUGGESTIONS = 5;

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
  const blockList = useBlockList();
  // Which list a suggestion gets added to when tapped -- FOCUS (blocked whenever a pomodoro/work
  // schedule is active, no end date until removed by hand) or NIGHT (the existing automatic
  // overnight window from task 11.9/11.10/11.22, jog/step-to-unlock and all). Deliberately a
  // single choice for the whole panel rather than per-suggestion, since a user picking "block my
  // socials" is almost always choosing one strategy for all of them at once.
  const [blockScope, setBlockScope] = useState<BlockListScope>('FOCUS');
  const nightWindow = useNightWindow();
  const scopeOptions = useMemo<{ scope: BlockListScope; label: string }[]>(
    () => [
      { scope: 'FOCUS', label: 'Indefinidamente (Enfoque)' },
      {
        scope: 'NIGHT',
        label: `Solo de noche (${formatNightWindowMinutes(nightWindow.startMinutes)}-${formatNightWindowMinutes(nightWindow.endMinutes)})`,
      },
    ],
    [nightWindow.startMinutes, nightWindow.endMinutes],
  );
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

  // Scoped to whichever list is currently selected above -- an app already blocked in that same
  // scope shouldn't be suggested again, but being blocked in the *other* scope doesn't disqualify
  // it (FOCUS and NIGHT are independent lists, same as blocklist.tsx's own two tabs).
  const blockedPackagesInScope = useMemo(
    () =>
      new Set(
        blockList.entries
          .filter((entry) => entry.kind === 'MOBILE_APP' && entry.platform === 'ANDROID' && entry.scope === blockScope)
          .map((entry) => entry.identifier),
      ),
    [blockList.entries, blockScope],
  );

  // weekUsage is already sorted descending (useScreenTime.ts), so this stays "most used first"
  // without re-sorting. isKnownDistractingApp checks a curated known-package list
  // (distractingApps.ts) -- not Android's own app-category field, which real-device testing showed
  // is too unreliable for this (see that file's comment for what went wrong).
  const suggestions = useMemo(
    () =>
      screenTime.weekUsage
        .filter((record) => isKnownDistractingApp(record.packageName) && !blockedPackagesInScope.has(record.packageName))
        .slice(0, MAX_SUGGESTIONS),
    [screenTime.weekUsage, blockedPackagesInScope],
  );

  function blockSuggestion(record: AppUsageRecord) {
    void blockList.createEntry({
      kind: 'MOBILE_APP',
      identifier: record.packageName,
      label: labels.get(record.packageName) ?? record.packageName,
      platform: 'ANDROID',
      highDopamine: true,
      enabled: true,
      hardMode: false,
      scope: blockScope,
    });
  }

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

              <TutorialTarget id="screen-time-suggestions">
                <AppCard>
                  <YStack gap="$3">
                    <Text fontWeight="700">Sugerencias de bloqueo</Text>
                    <YStack gap="$2">
                      <Text color="$muted" fontSize="$2">
                        Por cuanto tiempo bloquearlas
                      </Text>
                      <XStack gap="$2" flexWrap="wrap">
                        {scopeOptions.map((option) => (
                          <AppButton
                            key={option.scope}
                            variant={blockScope === option.scope ? 'primary' : 'ghost'}
                            onPress={() => setBlockScope(option.scope)}
                          >
                            {option.label}
                          </AppButton>
                        ))}
                      </XStack>
                    </YStack>
                    {isLoading || blockList.isLoading ? (
                      <Paragraph margin={0} color="$muted">
                        Cargando...
                      </Paragraph>
                    ) : suggestions.length === 0 ? (
                      <Paragraph margin={0} color="$muted">
                        No detectamos apps de alto consumo sin bloquear (en esta lista) entre tus
                        apps mas usadas de los ultimos 7 dias.
                      </Paragraph>
                    ) : (
                      <YStack gap="$3">
                        <Paragraph margin={0} color="$muted" fontSize="$2">
                          Redes sociales y apps de video entre tus apps mas usadas -- agregalas con
                          un toque a la lista elegida arriba.
                        </Paragraph>
                        {suggestions.map((record) => (
                          <XStack key={record.packageName} justifyContent="space-between" alignItems="center" gap="$3">
                            <YStack flex={1}>
                              <Text numberOfLines={1}>{labels.get(record.packageName) ?? record.packageName}</Text>
                              <Text color="$muted" fontSize="$2">
                                {formatDuration(record.totalTimeMs)} esta semana
                              </Text>
                            </YStack>
                            <AppButton variant="primary" disabled={blockList.isMutating} onPress={() => blockSuggestion(record)}>
                              Bloquear
                            </AppButton>
                          </XStack>
                        ))}
                      </YStack>
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
