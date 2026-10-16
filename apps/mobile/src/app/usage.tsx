import {
  formatUsageDuration,
  summarizeUsageByCategory,
  USAGE_CATEGORIES,
  USAGE_CATEGORY_LABELS,
  type UsageCategory,
} from '@calendar/shared';
import { AppButton, AppCard, H1, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { useScreenTime } from '../hooks/useScreenTime';

// One bucket of the home screen's usage card (2026-10-15): the apps behind "Juegos", "Redes
// sociales" or "Series y streaming", with their time today or over the last 7 days.
export default function UsageCategoryScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const initial = USAGE_CATEGORIES.includes(params.category as UsageCategory) ? (params.category as UsageCategory) : 'GAMES';
  const [category, setCategory] = useState<UsageCategory>(initial);
  const [range, setRange] = useState<'today' | 'week'>('today');
  const screenTime = useScreenTime();
  const summary = useMemo(
    () => summarizeUsageByCategory(range === 'today' ? screenTime.todayUsage : screenTime.weekUsage),
    [range, screenTime.todayUsage, screenTime.weekUsage],
  );
  const { totalMs, apps } = summary[category];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#212e28' }}>
      <YStack width="100%" maxWidth={560} alignSelf="center" padding="$6" gap="$4">
        <Stack.Screen
          options={{
            title: USAGE_CATEGORY_LABELS[category],
            headerShown: true,
            headerStyle: { backgroundColor: '#212e28' },
            headerTintColor: '#f2f7f4',
          }}
        />
        <XStack gap="$2" flexWrap="wrap">
          {USAGE_CATEGORIES.map((c) => (
            <AppButton key={c} variant={c === category ? 'primary' : 'ghost'} onPress={() => setCategory(c)}>
              {USAGE_CATEGORY_LABELS[c]}
            </AppButton>
          ))}
        </XStack>
        <XStack gap="$2">
          <AppButton variant={range === 'today' ? 'primary' : 'ghost'} onPress={() => setRange('today')}>
            Hoy
          </AppButton>
          <AppButton variant={range === 'week' ? 'primary' : 'ghost'} onPress={() => setRange('week')}>
            7 días
          </AppButton>
        </XStack>
        <H1 margin={0}>{formatUsageDuration(totalMs)}</H1>
        <AppCard>
          <YStack gap="$3">
            {apps.length === 0 ? (
              <Paragraph margin={0} color="$muted">
                Nada en este rango.
              </Paragraph>
            ) : (
              apps.map((app) => (
                <XStack key={app.packageName} justifyContent="space-between" gap="$3">
                  <Text flex={1} numberOfLines={1} fontSize="$4">
                    {app.label ?? app.packageName}
                  </Text>
                  <Text fontSize="$4" fontWeight="700">
                    {formatUsageDuration(app.totalTimeMs)}
                  </Text>
                </XStack>
              ))
            )}
          </YStack>
        </AppCard>
        <Paragraph margin={0} color="$muted" fontSize="$2">
          Redes sociales es la misma lista que se bloquea en horario de trabajo y de noche (incluye YouTube); juegos son
          las apps que Android marca como juego. Las restricciones siguen igual: esto solo muestra el tiempo.
        </Paragraph>
      </YStack>
    </ScrollView>
  );
}
