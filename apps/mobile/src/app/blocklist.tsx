import { AppButton, AppCard, Eyebrow, H1, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { Input } from 'tamagui';
import { BlockListEntryRow } from '../components/blocklist/BlockListEntryRow';
import { InstalledAppRow } from '../components/blocklist/InstalledAppRow';
import { TutorialScrollView } from '../components/onboarding/TutorialScrollView';
import { TutorialTarget } from '../components/onboarding/TutorialTarget';
import { useOnboarding } from '../context/OnboardingContext';
import { useBlockList } from '../hooks/useBlockList';
import { useInstalledApps } from '../hooks/useInstalledApps';
import { useNightBlockEnabled } from '../hooks/useNightBlockEnabled';
import {
  isAccessibilityServiceEnabled,
  isFullScreenIntentAllowed,
  isIgnoringBatteryOptimizations,
  openAccessibilitySettings,
  openBatteryOptimizationSettings,
  openFullScreenIntentSettings,
} from '../lib/focusBlock/api';
import type { BlockListScope } from '@calendar/shared';

/**
 * Task 6.5. Two independent sections sharing one BlockListEntry list (packages/shared's unified
 * model, same one apps/web's /blocklist page edits): the entries already on the list (any kind,
 * any platform -- an entry created on web still shows here), and, Android-only, a picker over the
 * device's real installed apps to add/remove MOBILE_APP/ANDROID entries by package name. No
 * create/edit form for WEBSITE/DESKTOP_APP entries here -- that stays a web-only affair, this
 * screen's whole reason to exist is the installed-apps enumeration a browser can't do.
 *
 * The enumeration itself (lib/blocklist/installedApps.native.ts, react-native-launcher-kit's
 * Kotlin PackageManager binding) needs a custom Android dev client and could not be run/tested in
 * this environment (no Android SDK/emulator installed) -- see design.md decision for task 6.5.
 * What *is* verified here via the web preview: the screen mounts cleanly, the "not available on
 * web" fallback renders instead of crashing, and the existing-entries list/delete flow (which
 * doesn't touch the native module at all) round-trips through the real sync API.
 */
const SCOPE_TABS: { scope: BlockListScope; label: string }[] = [
  { scope: 'FOCUS', label: 'Enfoque' },
  { scope: 'NIGHT', label: 'Nocturna (22:30-8am)' },
];

export default function BlockListScreen() {
  const { entries, isLoading, isMutating, error, createEntry, deleteEntry } = useBlockList();
  const installedApps = useInstalledApps();
  const { startTour } = useOnboarding();
  const [search, setSearch] = useState('');
  const [activeScope, setActiveScope] = useState<BlockListScope>('FOCUS');
  const [nightEnabled, setNightEnabled] = useNightBlockEnabled();
  const [accessibilityEnabled, setAccessibilityEnabled] = useState(false);
  const [fullScreenIntentAllowed, setFullScreenIntentAllowed] = useState(false);
  const [batteryOptimizationIgnored, setBatteryOptimizationIgnored] = useState(false);

  // Re-checked every time this screen regains focus, not just on mount -- the only way to change
  // any of these is a system Settings screen this same card links to, so the user is expected to
  // leave and come back.
  useFocusEffect(
    useCallback(() => {
      setAccessibilityEnabled(isAccessibilityServiceEnabled());
      setFullScreenIntentAllowed(isFullScreenIntentAllowed());
      setBatteryOptimizationIgnored(isIgnoringBatteryOptimizations());
    }, []),
  );

  // Task 11.8/11.9: FOCUS (pomodoro/work-hours) and NIGHT (automatic 22:30-8am window) are
  // deliberately separate lists, not two views filtered from one -- the tab above picks which one
  // "Tu lista" and the installed-apps picker below operate on.
  const scopedEntries = useMemo(() => entries.filter((entry) => entry.scope === activeScope), [entries, activeScope]);

  const androidEntries = useMemo(
    () => scopedEntries.filter((entry) => entry.kind === 'MOBILE_APP' && entry.platform === 'ANDROID'),
    [scopedEntries],
  );

  const blockedPackageNames = useMemo(() => new Set(androidEntries.map((entry) => entry.identifier)), [androidEntries]);

  const filteredApps = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return installedApps.apps;
    return installedApps.apps.filter(
      (app) => app.label.toLowerCase().includes(query) || app.packageName.toLowerCase().includes(query),
    );
  }, [installedApps.apps, search]);

  function toggleApp(packageName: string, label: string) {
    const existing = androidEntries.find((entry) => entry.identifier === packageName);
    if (existing) {
      void deleteEntry(existing.id);
      return;
    }
    void createEntry({
      kind: 'MOBILE_APP',
      identifier: packageName,
      label,
      platform: 'ANDROID',
      highDopamine: false,
      enabled: true,
      hardMode: false,
      scope: activeScope,
    });
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      <Stack.Screen
        options={{
          title: 'Lista de bloqueo',
          headerShown: true,
          headerStyle: { backgroundColor: '#212e28' },
          headerTintColor: '#f2f7f4',
          headerRight: () => (
            <AppButton variant="ghost" paddingHorizontal="$2" onPress={() => startTour('blocklist')}>
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
              Lista de bloqueo
            </H1>
          </YStack>

          {error ? (
            <Text color="$danger" fontSize="$3">
              {error}
            </Text>
          ) : null}

          <TutorialTarget id="blocklist-scope-tabs">
            <XStack gap="$2" flexWrap="wrap">
              {SCOPE_TABS.map((tab) => (
                <AppButton
                  key={tab.scope}
                  variant={activeScope === tab.scope ? 'primary' : 'ghost'}
                  onPress={() => setActiveScope(tab.scope)}
                >
                  {tab.label}
                </AppButton>
              ))}
            </XStack>
          </TutorialTarget>

          {activeScope === 'NIGHT' ? (
            <AppCard>
              <YStack gap="$2">
                <H2 margin={0} fontSize="$5">
                  Bloqueo nocturno
                </H2>
                <Paragraph margin={0} color="$muted">
                  Bloquea automaticamente las apps de esta lista todas las noches de 22:30 a 8:00.
                  Si te despertas antes de las 7, siguen bloqueadas hasta que salgas a trotar (si la
                  deteccion de actividad esta activa) o hasta las 8:00, lo que ocurra primero.
                </Paragraph>
                <XStack gap="$2">
                  <AppButton variant={nightEnabled ? 'primary' : 'ghost'} onPress={() => setNightEnabled(true)}>
                    Activado
                  </AppButton>
                  <AppButton variant={!nightEnabled ? 'primary' : 'ghost'} onPress={() => setNightEnabled(false)}>
                    Desactivado
                  </AppButton>
                </XStack>
              </YStack>
            </AppCard>
          ) : null}

          {Platform.OS === 'android' ? (
            <TutorialTarget id="blocklist-real">
              <AppCard>
                <YStack gap="$2">
                  <H2 margin={0} fontSize="$5">
                    Bloqueo real
                  </H2>
                  {accessibilityEnabled ? (
                    <Text color="$accent" fontSize="$3">
                      Activado -- las apps de esta lista se bloquean de verdad durante un enfoque.
                    </Text>
                  ) : (
                    <YStack gap="$2">
                      <Paragraph margin={0} color="$muted">
                        Para que el bloqueo funcione de verdad (no solo como lista), activa el
                        servicio de accesibilidad de esta app en Ajustes de Android.
                      </Paragraph>
                      <AppButton variant="primary" onPress={() => openAccessibilitySettings()}>
                        Abrir Ajustes de accesibilidad
                      </AppButton>
                    </YStack>
                  )}

                  {accessibilityEnabled && !fullScreenIntentAllowed ? (
                    <YStack gap="$2" paddingTop="$2" borderTopWidth={1} borderTopColor="$borderColor">
                      <Paragraph margin={0} color="$muted">
                        Falta un permiso mas: sin el, la app te manda de vuelta a inicio pero no te
                        avisa por que. Activa las notificaciones de pantalla completa.
                      </Paragraph>
                      <AppButton variant="primary" onPress={() => openFullScreenIntentSettings()}>
                        Abrir Ajustes de notificaciones
                      </AppButton>
                    </YStack>
                  ) : null}

                  {!batteryOptimizationIgnored ? (
                    <YStack gap="$2" paddingTop="$2" borderTopWidth={1} borderTopColor="$borderColor">
                      <Paragraph margin={0} color="$muted">
                        Ultimo paso recomendado: Android puede cerrar el servicio de bloqueo para
                        ahorrar bateria, sobre todo de noche. Excluir esta app de la optimizacion
                        de bateria reduce ese riesgo, aunque no lo elimina del todo -- es un mejor
                        esfuerzo, no una garantia.
                      </Paragraph>
                      <AppButton variant="primary" onPress={() => openBatteryOptimizationSettings()}>
                        Abrir Ajustes de bateria
                      </AppButton>
                    </YStack>
                  ) : null}
                </YStack>
              </AppCard>
            </TutorialTarget>
          ) : null}

          <TutorialTarget id="blocklist-list">
            <AppCard>
              <YStack gap="$1">
                <H2 margin={0} fontSize="$5">
                  Tu lista
                </H2>
                {isLoading ? (
                  <Paragraph margin={0} color="$muted">
                    Cargando...
                  </Paragraph>
                ) : scopedEntries.length === 0 ? (
                  <Paragraph margin={0} color="$muted">
                    Todavia no agregaste nada a esta lista.
                  </Paragraph>
                ) : (
                  <YStack>
                    {scopedEntries.map((entry) => (
                      <BlockListEntryRow key={entry.id} entry={entry} isBusy={isMutating} onDelete={() => void deleteEntry(entry.id)} />
                    ))}
                  </YStack>
                )}
              </YStack>
            </AppCard>
          </TutorialTarget>

          <TutorialTarget id="blocklist-apps">
            <AppCard>
              <YStack gap="$3">
                <H2 margin={0} fontSize="$5">
                  Apps instaladas
                </H2>

                {!installedApps.isSupported ? (
                  <Paragraph margin={0} color="$muted">
                    Esta funcion lee la lista real de apps instaladas del sistema operativo, algo que
                    un navegador no puede hacer -- solo esta disponible en Android, compilando un dev
                    client (no funciona en Expo Go ni en esta vista previa web).
                  </Paragraph>
                ) : !installedApps.isLoaded ? (
                  <YStack gap="$2">
                    <Paragraph margin={0} color="$muted">
                      Carga la lista de apps instaladas en este dispositivo para elegir cuales bloquear.
                    </Paragraph>
                    <AppButton variant="primary" onPress={() => void installedApps.load()} disabled={installedApps.isLoading}>
                      {installedApps.isLoading ? 'Cargando...' : 'Cargar apps instaladas'}
                    </AppButton>
                    {installedApps.error ? (
                      <Text color="$danger" fontSize="$2">
                        {installedApps.error}
                      </Text>
                    ) : null}
                  </YStack>
                ) : (
                  <YStack gap="$3">
                    <Input placeholder="Buscar app..." value={search} onChangeText={setSearch} />
                    {filteredApps.length === 0 ? (
                      <Paragraph margin={0} color="$muted">
                        No se encontraron apps.
                      </Paragraph>
                    ) : (
                      <YStack>
                        {filteredApps.map((app) => (
                          <InstalledAppRow
                            key={app.packageName}
                            app={app}
                            isBlocked={blockedPackageNames.has(app.packageName)}
                            isBusy={isMutating}
                            onToggle={() => toggleApp(app.packageName, app.label)}
                          />
                        ))}
                      </YStack>
                    )}
                  </YStack>
                )}
              </YStack>
            </AppCard>
          </TutorialTarget>
        </YStack>
      </TutorialScrollView>
    </YStack>
  );
}
