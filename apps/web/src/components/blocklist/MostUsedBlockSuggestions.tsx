import { useEffect, useMemo, useState } from 'react';
import { AppButton, AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import {
  isKnownDistractingApp,
  normalizeWebsiteDomain,
  rankUsageSuggestions,
  websiteLabel,
  type BlockListScope,
  type UsageItem,
} from '@calendar/shared';
import { useSync } from '../../context/SyncContext';
import { useBlockList } from '../../hooks/useBlockList';
import { useNightSettings } from '../../hooks/useNightWindowActive';
import { isDesktop } from '../../lib/desktop';
import { formatNightWindowMinutes } from '../../lib/desktop/nightWindow';
import type { BlockListFormValues } from '../../lib/blocklist/types';

// "Las que mas usas" (user-requested, 2026-10-06): the apps and websites the user actually spends
// time on, on this PC and on the phone, each one tap away from the block list. PC apps and phone
// apps come from the synced daily rollups (DailyDesktopAppTime / DailyScreenTime, last 7 days);
// PC websites from the desktop's own tracker (website_tracking.rs, local to this PC). Same ranking
// and filters as the phone's MostUsedSuggestions (packages/shared usageSuggestions.ts).

const DAYS = 7;

function formatMinutes(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

// com.instagram.android -> "Instagram": phone rollups only carry the package name.
const PACKAGE_NOISE = new Set(['com', 'org', 'net', 'android', 'app', 'apps', 'mobile', 'client', 'google', 'samsung', 'sec']);
function packageLabel(packageName: string): string {
  const parts = packageName.split('.').filter((p) => !PACKAGE_NOISE.has(p));
  const word = parts[0] ?? packageName.split('.').pop() ?? packageName;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

interface Section {
  title: string;
  items: UsageItem[];
  toEntry: (item: UsageItem) => Omit<BlockListFormValues, 'enabled' | 'hardMode' | 'scope'>;
  tag?: (item: UsageItem) => string | undefined;
}

export function MostUsedBlockSuggestions() {
  const { pullSnapshot } = useSync();
  const blockList = useBlockList('ALL');
  const { window: nightWindow } = useNightSettings();
  const [scope, setScope] = useState<BlockListScope>('FOCUS');
  const [pcApps, setPcApps] = useState<UsageItem[]>([]);
  const [phoneApps, setPhoneApps] = useState<UsageItem[]>([]);
  const [pcSites, setPcSites] = useState<UsageItem[]>([]);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const since = new Date(Date.now() - DAYS * 86_400_000).toISOString().slice(0, 10);
    void pullSnapshot()
      .then((snapshot) => {
        if (cancelled) return;
        setPcApps(
          (snapshot.dailyDesktopAppTime ?? [])
            .filter((day) => day.date.slice(0, 10) >= since)
            .flatMap((day) => day.topApps.map((app) => ({ identifier: app.key, label: app.label, minutes: app.minutes }))),
        );
        setPhoneApps(
          (snapshot.dailyScreenTime ?? [])
            .filter((day) => day.date.slice(0, 10) >= since)
            .flatMap((day) =>
              day.topApps.map((app) => ({ identifier: app.packageName, label: packageLabel(app.packageName), minutes: app.minutes })),
            ),
        );
      })
      .catch(() => undefined);

    if (isDesktop) {
      void import('@tauri-apps/api/core')
        .then(({ invoke }) => invoke<{ domain: string; minutes: number }[]>('get_website_time', { days: DAYS }))
        .then((rows) => {
          if (!cancelled) {
            setPcSites(rows.map((row) => ({ identifier: row.domain, label: websiteLabel(row.domain), minutes: row.minutes })));
          }
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [pullSnapshot]);

  const sections = useMemo<Section[]>(() => {
    const inScope = blockList.entries.filter((entry) => (entry.scope ?? 'FOCUS') === scope);
    const blocked = (kind: string) =>
      inScope
        .filter((entry) => entry.kind === kind)
        .map((entry) => (kind === 'WEBSITE' ? normalizeWebsiteDomain(entry.identifier) ?? entry.identifier : entry.identifier));
    const list: Section[] = [];
    if (isDesktop) {
      list.push({
        title: 'Programas del PC',
        items: rankUsageSuggestions(pcApps, blocked('DESKTOP_APP')),
        toEntry: (item) => ({ kind: 'DESKTOP_APP', identifier: item.identifier, label: item.label, platform: 'WINDOWS', highDopamine: false }),
      });
      list.push({
        title: 'Webs en el PC',
        items: rankUsageSuggestions(pcSites, blocked('WEBSITE')),
        // No platform: a site is blocked on the PC (hosts file) and on the phone (its browsers).
        toEntry: (item) => ({ kind: 'WEBSITE', identifier: item.identifier, label: item.label, platform: null, highDopamine: false }),
      });
    }
    list.push({
      title: 'Apps del celular',
      items: rankUsageSuggestions(phoneApps, blocked('MOBILE_APP')),
      toEntry: (item) => ({
        kind: 'MOBILE_APP',
        identifier: item.identifier,
        label: item.label,
        platform: 'ANDROID',
        highDopamine: isKnownDistractingApp(item.identifier),
      }),
      tag: (item) => (isKnownDistractingApp(item.identifier) ? 'red social' : undefined),
    });
    return list;
  }, [blockList.entries, scope, pcApps, pcSites, phoneApps]);

  async function block(section: Section, item: UsageItem) {
    setPending(`${section.title}:${item.identifier}`);
    try {
      await blockList.createEntry({ ...section.toEntry(item), enabled: true, hardMode: false, scope });
    } finally {
      setPending(null);
    }
  }

  if (sections.every((section) => section.items.length === 0) && !isDesktop) return null;

  return (
    <AppCard>
      <YStack gap="$4">
        <YStack gap="$1">
          <H2 margin={0} fontSize="$5">
            Las que mas usas
          </H2>
          <Paragraph margin={0} color="$muted">
            Tus programas, webs y apps del celular con mas tiempo en los ultimos 7 dias. Agregalos a
            la lista con un toque; una web se bloquea en el PC y en el celular.
          </Paragraph>
        </YStack>

        <XStack gap="$2" flexWrap="wrap">
          {(
            [
              { scope: 'FOCUS', label: 'Bloqueo total (enfoque)' },
              {
                scope: 'NIGHT',
                label: `Solo de noche (${formatNightWindowMinutes(nightWindow.startMinutes)}-${formatNightWindowMinutes(nightWindow.endMinutes)})`,
              },
            ] as const
          ).map((option) => (
            <AppButton
              key={option.scope}
              type="button"
              variant={scope === option.scope ? 'primary' : 'ghost'}
              onPress={() => setScope(option.scope)}
            >
              {option.label}
            </AppButton>
          ))}
        </XStack>

        {sections.map((section) => (
          <YStack key={section.title} gap="$2">
            <Text fontWeight="700">{section.title}</Text>
            {section.items.length === 0 ? (
              <Paragraph margin={0} color="$muted" fontSize="$2">
                {section.title === 'Webs en el PC'
                  ? 'Todavia no hay datos: se mide el tiempo en Chrome, Edge, Brave, Vivaldi y Opera desde ahora.'
                  : 'Nada para sugerir en esta lista.'}
              </Paragraph>
            ) : (
              section.items.map((item) => {
                const key = `${section.title}:${item.identifier}`;
                const tag = section.tag?.(item);
                return (
                  <XStack key={key} justifyContent="space-between" alignItems="center" gap="$3" flexWrap="wrap">
                    <YStack gap="$0">
                      <Text fontWeight="600">{item.label}</Text>
                      <Text fontSize="$2" color="$muted">
                        {formatMinutes(item.minutes)} en 7 dias{tag ? ` · ${tag}` : ''}
                        {item.label.toLowerCase() !== item.identifier ? ` · ${item.identifier}` : ''}
                      </Text>
                    </YStack>
                    <AppButton
                      type="button"
                      variant="primary"
                      disabled={blockList.isMutating || pending !== null}
                      onPress={() => void block(section, item)}
                    >
                      {pending === key ? 'Agregando...' : 'Bloquear'}
                    </AppButton>
                  </XStack>
                );
              })
            )}
          </YStack>
        ))}
      </YStack>
    </AppCard>
  );
}
