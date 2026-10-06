import {
  isKnownDistractingApp,
  normalizeWebsiteDomain,
  rankUsageSuggestions,
  websiteLabel,
  type BlockListScope,
  type UsageItem,
} from '@calendar/shared';
import { AppButton, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Input } from 'tamagui';
import { useInstalledApps } from '../../hooks/useInstalledApps';
import { useScreenTime } from '../../hooks/useScreenTime';
import type { BlockListFormValues, SyncBlockListRecord } from '../../lib/blocklist/types';
import { getWebsiteUsage, isAccessibilityServiceEnabled } from '../../lib/focusBlock/api';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// "Las que más usas" (user-requested, 2026-10-06): this phone's most used apps of the last 7 days
// -- all of them, not only the curated social/game list -- and the websites it spends most time
// on, each one tap away from the block list in `scope`. Plus a box to add any website by hand.

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

interface Props {
  scope: BlockListScope;
  entries: SyncBlockListRecord[];
  isMutating: boolean;
  createEntry: (values: BlockListFormValues) => Promise<void>;
  /** A short confirmation or error to show the user. */
  onMessage?: (message: string) => void;
}

export function MostUsedSuggestions({ scope, entries, isMutating, createEntry, onMessage }: Props) {
  const screenTime = useScreenTime();
  const installedApps = useInstalledApps();
  const [websites, setWebsites] = useState<UsageItem[]>([]);
  const [readsSites, setReadsSites] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [siteInput, setSiteInput] = useState('');

  useEffect(() => {
    if (installedApps.isSupported && !installedApps.isLoaded && !installedApps.isLoading) void installedApps.load();
    // Loads once; the hook keeps its own state.
  }, [installedApps.isSupported]);

  // Re-read every time the screen comes back: usage keeps growing, and access may have just been granted.
  useFocusEffect(
    useCallback(() => {
      screenTime.refresh();
      const now = Date.now();
      setWebsites(
        getWebsiteUsage(now - WEEK_MS, now).map((record) => ({
          identifier: record.domain,
          label: websiteLabel(record.domain),
          minutes: Math.round(record.totalTimeMs / 60_000),
        })),
      );
      setReadsSites(isAccessibilityServiceEnabled());
    }, []),
  );

  const labels = useMemo(() => new Map(installedApps.apps.map((app) => [app.packageName, app.label])), [installedApps.apps]);
  const inScope = useMemo(() => entries.filter((entry) => entry.scope === scope), [entries, scope]);

  const apps = useMemo(() => {
    const items = screenTime.weekUsage
      // Launchable apps only: background services and system components have no label here.
      .filter((record) => labels.has(record.packageName))
      .map((record) => ({
        identifier: record.packageName,
        label: labels.get(record.packageName) ?? record.packageName,
        minutes: Math.round(record.totalTimeMs / 60_000),
      }));
    const blocked = inScope.filter((entry) => entry.kind === 'MOBILE_APP').map((entry) => entry.identifier);
    return rankUsageSuggestions(items, blocked);
  }, [screenTime.weekUsage, labels, inScope]);

  const sites = useMemo(() => {
    const blocked = inScope
      .filter((entry) => entry.kind === 'WEBSITE')
      .map((entry) => normalizeWebsiteDomain(entry.identifier) ?? entry.identifier);
    return rankUsageSuggestions(websites, blocked);
  }, [websites, inScope]);

  async function add(values: Omit<BlockListFormValues, 'enabled' | 'hardMode' | 'scope'>) {
    setPending(values.identifier);
    try {
      await createEntry({ ...values, enabled: true, hardMode: false, scope });
      onMessage?.(`${values.label} agregada a la lista.`);
    } catch {
      onMessage?.(`No se pudo agregar ${values.label}.`);
    } finally {
      setPending(null);
    }
  }

  function addApp(item: UsageItem) {
    void add({
      kind: 'MOBILE_APP',
      identifier: item.identifier,
      label: item.label,
      platform: 'ANDROID',
      highDopamine: isKnownDistractingApp(item.identifier),
    });
  }

  function addSite(domain: string) {
    // No platform: a website entry applies on every device (desktop hosts file and phone browsers).
    void add({ kind: 'WEBSITE', identifier: domain, label: websiteLabel(domain), platform: null, highDopamine: false });
  }

  function addTypedSite() {
    const domain = normalizeWebsiteDomain(siteInput);
    if (!domain) {
      onMessage?.('Escribi un dominio, por ejemplo youtube.com');
      return;
    }
    if (inScope.some((entry) => entry.kind === 'WEBSITE' && normalizeWebsiteDomain(entry.identifier) === domain)) {
      onMessage?.(`${domain} ya esta en esta lista.`);
      return;
    }
    setSiteInput('');
    addSite(domain);
  }

  const row = (item: UsageItem, onAdd: () => void, tag?: string) => (
    <XStack key={item.identifier} justifyContent="space-between" alignItems="center" gap="$3">
      <YStack flex={1}>
        <Text numberOfLines={1}>{item.label}</Text>
        <Text color="$muted" fontSize="$2" numberOfLines={1}>
          {formatMinutes(item.minutes)} en 7 dias{tag ? ` · ${tag}` : ''}
        </Text>
      </YStack>
      <AppButton variant="primary" disabled={isMutating || pending !== null} onPress={onAdd}>
        {pending === item.identifier ? 'Agregando...' : 'Bloquear'}
      </AppButton>
    </XStack>
  );

  return (
    <YStack gap="$4">
      <YStack gap="$2">
        <H2 margin={0} fontSize="$5">
          Apps que mas usas
        </H2>
        {!screenTime.isSupported ? (
          <Paragraph margin={0} color="$muted">
            Solo en Android.
          </Paragraph>
        ) : screenTime.hasAccess === false ? (
          <YStack gap="$2">
            <Paragraph margin={0} color="$muted">
              Para saber cuales usas mas, activa "Acceso a datos de uso" para Calendar Productivity.
            </Paragraph>
            <AppButton variant="primary" onPress={screenTime.requestAccess}>
              Abrir Ajustes
            </AppButton>
          </YStack>
        ) : screenTime.isLoading || (installedApps.isSupported && !installedApps.isLoaded) ? (
          <Paragraph margin={0} color="$muted">
            Cargando...
          </Paragraph>
        ) : apps.length === 0 ? (
          <Paragraph margin={0} color="$muted">
            Nada para sugerir: ya bloqueaste en esta lista todo lo que mas usas.
          </Paragraph>
        ) : (
          apps.map((item) => row(item, () => addApp(item), isKnownDistractingApp(item.identifier) ? 'red social' : undefined))
        )}
      </YStack>

      <YStack gap="$2">
        <H2 margin={0} fontSize="$5">
          Webs donde mas pasas tiempo
        </H2>
        {!readsSites ? (
          <Paragraph margin={0} color="$muted">
            Se miden con el servicio de accesibilidad de la app (lee solo el dominio en el navegador).
            Activalo arriba para empezar a medir.
          </Paragraph>
        ) : sites.length === 0 ? (
          <Paragraph margin={0} color="$muted">
            Todavia no hay datos: se empiezan a medir desde ahora, en Chrome, Brave, Edge, Samsung
            Internet, Firefox y otros.
          </Paragraph>
        ) : (
          sites.map((item) => row(item, () => addSite(item.identifier)))
        )}

        <Text color="$muted" fontSize="$2">
          Agregar una web a mano (se bloquea en el celular y en el PC)
        </Text>
        <XStack gap="$2" alignItems="center">
          <Input
            flex={1}
            placeholder="youtube.com"
            value={siteInput}
            onChangeText={setSiteInput}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onSubmitEditing={addTypedSite}
          />
          <AppButton variant="primary" disabled={isMutating || pending !== null || !siteInput.trim()} onPress={addTypedSite}>
            Agregar
          </AppButton>
        </XStack>
      </YStack>
    </YStack>
  );
}
