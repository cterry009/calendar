import { AppButton, AppCard, Eyebrow, H1, H2, Paragraph, Text, YStack } from '@calendar/ui';
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { Input } from 'tamagui';
import { BlockListEntryRow } from '../components/blocklist/BlockListEntryRow';
import { InstalledAppRow } from '../components/blocklist/InstalledAppRow';
import { useBlockList } from '../hooks/useBlockList';
import { useInstalledApps } from '../hooks/useInstalledApps';

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
export default function BlockListScreen() {
  const { entries, isLoading, isMutating, error, createEntry, deleteEntry } = useBlockList();
  const installedApps = useInstalledApps();
  const [search, setSearch] = useState('');

  const androidEntries = useMemo(
    () => entries.filter((entry) => entry.kind === 'MOBILE_APP' && entry.platform === 'ANDROID'),
    [entries],
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
        }}
      />

      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <YStack padding="$6" gap="$5">
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

          <AppCard>
            <YStack gap="$1">
              <H2 margin={0} fontSize="$5">
                Tu lista
              </H2>
              {isLoading ? (
                <Paragraph margin={0} color="$muted">
                  Cargando...
                </Paragraph>
              ) : entries.length === 0 ? (
                <Paragraph margin={0} color="$muted">
                  Todavia no agregaste nada a la lista de bloqueo.
                </Paragraph>
              ) : (
                <YStack>
                  {entries.map((entry) => (
                    <BlockListEntryRow key={entry.id} entry={entry} isBusy={isMutating} onDelete={() => void deleteEntry(entry.id)} />
                  ))}
                </YStack>
              )}
            </YStack>
          </AppCard>

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
        </YStack>
      </ScrollView>
    </YStack>
  );
}
