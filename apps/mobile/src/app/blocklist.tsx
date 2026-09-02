import { AppButton, AppCard, Eyebrow, H1, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useNightWindow } from '../hooks/useNightWindow';
import { MIN_NIGHT_WINDOW_MINUTES, formatNightWindowMinutes, nightWindowDurationMinutes } from '../lib/nightBlock/state';
import {
  isAccessibilityServiceEnabled,
  isFullScreenIntentAllowed,
  isIgnoringBatteryOptimizations,
  openAccessibilitySettings,
  openBatteryOptimizationSettings,
  openFullScreenIntentSettings,
} from '../lib/focusBlock/api';
import type { InstalledAppInfo } from '../lib/blocklist/installedApps.types';
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
  { scope: 'NIGHT', label: 'Nocturna' },
];

// Returns null for anything that isn't a plain "H:MM"/"HH:MM" 24h time -- the caller shows a
// generic parse error rather than trying to guess what the user meant.
function parseTimeInput(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

const INSTALLED_APPS_MAX_RESULTS = 5;

function levenshteinDistance(a: string, b: string): number {
  const previousRow: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previousRow[0];
    previousRow[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const upLeft = diagonal;
      diagonal = previousRow[j];
      previousRow[j] = a[i - 1] === b[j - 1] ? upLeft : 1 + Math.min(upLeft, previousRow[j], previousRow[j - 1]);
    }
  }
  return previousRow[b.length];
}

// Ranks how closely an app matches the search word -- higher is closer. Substring/prefix hits on
// the visible label (the common case: typing part of an app's name) rank above a package-name hit,
// which ranks above a pure typo-tolerance fallback via edit distance against the label. Returns
// null when nothing about the app resembles the query, so a search for "banco" doesn't pad the
// results out with five unrelated apps just to hit a quota.
function matchScore(app: InstalledAppInfo, query: string): number | null {
  const label = app.label.toLowerCase();
  const pkg = app.packageName.toLowerCase();

  if (label === query) return 1000;
  if (label.startsWith(query)) return 900 - (label.length - query.length);

  const labelIndex = label.indexOf(query);
  if (labelIndex !== -1) return 800 - labelIndex - (label.length - query.length) * 0.1;

  const pkgIndex = pkg.indexOf(query);
  if (pkgIndex !== -1) return 700 - pkgIndex;

  // Typo tolerance: only counts as a match if the label is proportionally close to the query
  // (e.g. "instagarm" -> "instagram" is 2 transpositions on a 9-char word), not just "somewhat
  // similar in length" -- otherwise short/generic labels would match almost anything.
  const distance = levenshteinDistance(label, query);
  const maxAllowedDistance = Math.max(2, Math.ceil(query.length * 0.4));
  return distance <= maxAllowedDistance ? 600 - distance * 10 : null;
}

// Ranked top-N instead of "every app whose name contains the query" -- with a few hundred apps
// installed, that unranked list was the whole point of the user's complaint (they have to type
// the exact right substring, or scroll a wall of results to find what they meant).
function searchInstalledApps(apps: InstalledAppInfo[], query: string): InstalledAppInfo[] {
  if (!query) return [];

  const scored: { app: InstalledAppInfo; score: number }[] = [];
  for (const app of apps) {
    const score = matchScore(app, query);
    if (score !== null) scored.push({ app, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, INSTALLED_APPS_MAX_RESULTS).map((entry) => entry.app);
}

export default function BlockListScreen() {
  const { entries, isLoading, isMutating, error, createEntry, deleteEntry } = useBlockList();
  const installedApps = useInstalledApps();
  const { startTour } = useOnboarding();
  const [search, setSearch] = useState('');
  const [activeScope, setActiveScope] = useState<BlockListScope>('FOCUS');
  const [nightEnabled, setNightEnabled] = useNightBlockEnabled();
  const nightWindow = useNightWindow();
  const [startInput, setStartInput] = useState(() => formatNightWindowMinutes(nightWindow.startMinutes));
  const [endInput, setEndInput] = useState(() => formatNightWindowMinutes(nightWindow.endMinutes));
  const [windowError, setWindowError] = useState<string | null>(null);
  const [windowSaving, setWindowSaving] = useState(false);
  // Shown right next to the button that was pressed, not just in the top-of-screen flash banner
  // below -- this section sits well below the fold once "Horario (minimo 10 horas)" is reached,
  // so a confirmation the user has to scroll up to see doesn't fix "I can't tell if it saved".
  const [windowJustSaved, setWindowJustSaved] = useState(false);
  // Which specific row a create/delete is in flight for -- isMutating alone can't tell "Ampere"'s
  // row apart from "Instagram"'s, so every button would have to guess from one shared boolean.
  // Cleared in toggleApp's finally regardless of outcome, so a failed mutation doesn't leave a
  // row stuck saying "Agregando..." forever.
  const [pendingPackage, setPendingPackage] = useState<string | null>(null);
  // Ephemeral confirmation text (blocklist.tsx has no toast system yet) -- the user reported
  // pressing Guardar/Quitar/Bloquear and seeing no response at all, so every one of those actions
  // now leaves a visible trace here for a couple seconds, success or not.
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  function flash(message: string) {
    setFlashMessage(message);
    setTimeout(() => setFlashMessage((current) => (current === message ? null : current)), 2500);
  }

  // The hook's initial value is a synchronous placeholder (the real one comes from an async
  // AsyncStorage read) -- this re-syncs the displayed text once that resolves, and again after a
  // successful save (confirming what actually got persisted).
  useEffect(() => {
    setStartInput(formatNightWindowMinutes(nightWindow.startMinutes));
    setEndInput(formatNightWindowMinutes(nightWindow.endMinutes));
  }, [nightWindow.startMinutes, nightWindow.endMinutes]);
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

  const filteredApps = useMemo(
    () => searchInstalledApps(installedApps.apps, search.trim().toLowerCase()),
    [installedApps.apps, search],
  );

  async function removeEntry(entryId: string, identifier: string, label: string) {
    setPendingPackage(identifier);
    try {
      await deleteEntry(entryId);
      flash(`"${label}" se quito de la lista.`);
    } catch {
      // useBlockList's own `error` state already surfaces the failure reason -- this just avoids
      // a stuck "Quitando..." label on the row that triggered it.
    } finally {
      setPendingPackage(null);
    }
  }

  async function toggleApp(packageName: string, label: string) {
    const existing = androidEntries.find((entry) => entry.identifier === packageName);
    if (existing) {
      await removeEntry(existing.id, packageName, label);
      return;
    }

    setPendingPackage(packageName);
    try {
      await createEntry({
        kind: 'MOBILE_APP',
        identifier: packageName,
        label,
        platform: 'ANDROID',
        highDopamine: false,
        enabled: true,
        hardMode: false,
        scope: activeScope,
      });
      flash(`"${label}" se agrego a la lista.`);
    } catch {
      // see removeEntry's catch above
    } finally {
      setPendingPackage(null);
    }
  }

  async function saveNightWindow() {
    const startMinutes = parseTimeInput(startInput);
    const endMinutes = parseTimeInput(endInput);

    if (startMinutes === null || endMinutes === null) {
      setWindowError('Escribi la hora en formato HH:MM, por ejemplo 22:30.');
      return;
    }

    setWindowSaving(true);
    setWindowJustSaved(false);
    try {
      const result = await nightWindow.setWindow({ startMinutes, endMinutes });
      setWindowError(result.ok ? null : result.error);
      if (result.ok) {
        flash('Horario guardado.');
        setWindowJustSaved(true);
        setTimeout(() => setWindowJustSaved(false), 2500);
      }
    } finally {
      setWindowSaving(false);
    }
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
          {flashMessage ? (
            <Text color="$accent" fontSize="$3" fontWeight="600">
              {flashMessage}
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
                  Bloquea automaticamente las apps de esta lista todas las noches, de{' '}
                  {formatNightWindowMinutes(nightWindow.startMinutes)} a {formatNightWindowMinutes(nightWindow.endMinutes)}.
                  Si te despertas antes de que termine la ventana, siguen bloqueadas hasta que
                  salgas a trotar, des 1000 pasos (si la deteccion de actividad/pasos esta activa),
                  o hasta que termine la ventana -- lo que ocurra primero.
                </Paragraph>
                <XStack gap="$2">
                  <AppButton variant={nightEnabled ? 'primary' : 'ghost'} onPress={() => setNightEnabled(true)}>
                    Activado
                  </AppButton>
                  <AppButton variant={!nightEnabled ? 'primary' : 'ghost'} onPress={() => setNightEnabled(false)}>
                    Desactivado
                  </AppButton>
                </XStack>

                <YStack gap="$2" paddingTop="$2" borderTopWidth={1} borderTopColor="$borderColor">
                  <Text fontWeight="700" fontSize="$3">
                    Horario (minimo 10 horas)
                  </Text>
                  <XStack gap="$2" alignItems="center" flexWrap="wrap">
                    <YStack gap="$1">
                      <Text color="$muted" fontSize="$2">
                        Inicio
                      </Text>
                      <Input value={startInput} onChangeText={setStartInput} placeholder="22:30" width={100} />
                    </YStack>
                    <YStack gap="$1">
                      <Text color="$muted" fontSize="$2">
                        Fin
                      </Text>
                      <Input value={endInput} onChangeText={setEndInput} placeholder="08:00" width={100} />
                    </YStack>
                    <AppButton variant="primary" onPress={() => void saveNightWindow()} disabled={windowSaving}>
                      {windowSaving ? 'Guardando...' : 'Guardar horario'}
                    </AppButton>
                  </XStack>
                  {windowError ? (
                    <Text color="$danger" fontSize="$2">
                      {windowError}
                    </Text>
                  ) : windowJustSaved ? (
                    <Text color="$accent" fontSize="$2" fontWeight="700">
                      Horario guardado.
                    </Text>
                  ) : (
                    <Text color="$muted" fontSize="$2">
                      Dura{' '}
                      {Math.round((nightWindowDurationMinutes(nightWindow.startMinutes, nightWindow.endMinutes) / 60) * 10) /
                        10}{' '}
                      horas (minimo {MIN_NIGHT_WINDOW_MINUTES / 60}h). La hora de inicio debe ser
                      mas tarde que la de fin -- la ventana siempre cruza la medianoche.
                    </Text>
                  )}
                </YStack>
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
                      <BlockListEntryRow
                        key={entry.id}
                        entry={entry}
                        isBusy={isMutating}
                        isPending={pendingPackage === entry.identifier}
                        onDelete={() => void removeEntry(entry.id, entry.identifier, entry.label)}
                      />
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
                    {search.trim() === '' ? (
                      <Paragraph margin={0} color="$muted">
                        Escribi el nombre de una app para buscarla.
                      </Paragraph>
                    ) : filteredApps.length === 0 ? (
                      <Paragraph margin={0} color="$muted">
                        No se encontraron apps parecidas a "{search.trim()}".
                      </Paragraph>
                    ) : (
                      <YStack>
                        {filteredApps.map((app) => (
                          <InstalledAppRow
                            key={app.packageName}
                            app={app}
                            isBlocked={blockedPackageNames.has(app.packageName)}
                            isBusy={isMutating}
                            isPending={pendingPackage === app.packageName}
                            onToggle={() => void toggleApp(app.packageName, app.label)}
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
