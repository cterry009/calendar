import { formatUsageDuration, summarizeUsageByCategory, USAGE_CATEGORIES, USAGE_CATEGORY_LABELS } from '@calendar/shared';
import { AppButton, AppCard, Text, XStack, YStack } from '@calendar/ui';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { AppState, Pressable } from 'react-native';
import { useScreenTime } from '../../hooks/useScreenTime';

const CATEGORY_COLORS = { GAMES: '#e0b64c', SOCIAL: '#e06c8a', STREAMING: '#6c9ee0' } as const;

// Home screen headline (user-requested, 2026-10-15): today's time in games, social media and
// series/streaming, big, each tile opening the apps behind it. Read live from the phone's own usage
// stats (useScreenTime), refreshed whenever the app comes back to the front. Just a mirror: the
// blocking rules don't read it.
export function UsageCategoriesCard() {
  const router = useRouter();
  const screenTime = useScreenTime();
  const { refresh } = screenTime;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const summary = useMemo(() => summarizeUsageByCategory(screenTime.todayUsage), [screenTime.todayUsage]);

  if (!screenTime.isSupported) return null;

  if (screenTime.hasAccess === false) {
    return (
      <AppCard>
        <YStack gap="$2">
          <Text fontWeight="700">Tiempo en juegos, redes y streaming</Text>
          <Text color="$muted" fontSize="$3">
            Para contarlo, el celular necesita el permiso de acceso al uso.
          </Text>
          <AppButton variant="primary" onPress={screenTime.requestAccess}>
            Dar permiso
          </AppButton>
        </YStack>
      </AppCard>
    );
  }

  return (
    <YStack gap="$3">
      <Text color="$muted" fontSize="$2" textTransform="uppercase" letterSpacing={1.5}>
        Hoy en el celular
      </Text>
      {USAGE_CATEGORIES.map((category) => {
        const { totalMs, apps } = summary[category];
        const top = apps
          .slice(0, 2)
          .map((app) => app.label ?? app.packageName)
          .join(', ');
        return (
          <Pressable key={category} onPress={() => router.push({ pathname: '/usage', params: { category } })}>
            <AppCard>
              {/* The number on its own line: beside the name it squeezed "Redes sociales" into one
                  syllable per line on the phone (2026-10-15). */}
              <XStack gap="$4">
                <YStack width={6} alignSelf="stretch" borderRadius={3} backgroundColor={CATEGORY_COLORS[category]} />
                <YStack flex={1} gap="$1">
                  <XStack justifyContent="space-between" alignItems="baseline" gap="$2">
                    <Text fontSize="$4" fontWeight="700">
                      {USAGE_CATEGORY_LABELS[category]}
                    </Text>
                    <Text fontSize="$2" color="$muted">
                      ver apps ›
                    </Text>
                  </XStack>
                  <Text fontSize={40} lineHeight={46} fontWeight="800" color={CATEGORY_COLORS[category]}>
                    {formatUsageDuration(totalMs)}
                  </Text>
                  <Text fontSize="$2" color="$muted" numberOfLines={1}>
                    {top || 'Nada hoy'}
                  </Text>
                </YStack>
              </XStack>
            </AppCard>
          </Pressable>
        );
      })}
    </YStack>
  );
}
