import { localDateKey } from '@calendar/shared';
import { Text, XStack, YStack } from '@calendar/ui';
import { useCalendarData } from '../../hooks/useCalendarData';
import { useToday } from '../../hooks/useNow';
import { goalsToday, goalsWeek, motivation } from '../../lib/stats/goals';

// 2026-11-10: the always-visible reference at the top right: goals today and this week, the last
// energy registered today and a line that fits how the day is going.

export function NavStats() {
  const data = useCalendarData();
  const today = useToday();
  const day = goalsToday(data, today);
  const week = goalsWeek(data, today);
  const todayKey = localDateKey(today);
  const lastEnergy = [...data.checkIns].reverse().find((c) => c.energy !== null && localDateKey(new Date(c.at)) === todayKey)?.energy ?? null;
  return (
    <YStack alignItems="flex-end" gap={2} paddingHorizontal="$2" aria-label="Resumen del día">
      <XStack gap="$3" alignItems="baseline">
        <Text fontSize="$2" color="$muted">
          Hoy <Text fontWeight="800" color="$color">{day.done}/{day.total}</Text>
        </Text>
        <Text fontSize="$2" color="$muted">
          Semana <Text fontWeight="800" color="$color">{week.done}/{week.total}</Text>
        </Text>
        <Text fontSize="$2" color="$muted">
          Energía <Text fontWeight="800" color="$color">{lastEnergy ?? '—'}</Text>
        </Text>
      </XStack>
      <Text fontSize="$1" color="$accent">
        {motivation(day, today)}
      </Text>
    </YStack>
  );
}
