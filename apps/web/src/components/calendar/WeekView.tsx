import { AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import type { WeekDaySummary } from '../../lib/calendar/types';

interface WeekViewProps {
  days: WeekDaySummary[];
}

function formatHours(minutes: number): string {
  return `${(minutes / 60).toFixed(1)} h`;
}

function indicator(count: number): string {
  if (count <= 0) return '—';
  if (count === 1) return '•';
  if (count === 2) return '••';
  if (count === 3) return '•••';
  return '••••';
}

export function WeekView({ days }: WeekViewProps) {
  return (
    <AppCard>
      <YStack gap="$4">
        <H2 margin={0} fontSize="$6">
          Resumen semanal
        </H2>

        <XStack flexWrap="wrap" gap="$3">
          {days.map((day) => (
            <YStack
              key={day.date.toISOString()}
              flex={1}
              minWidth={140}
              gap="$2"
              padding="$3"
              borderRadius="$3"
              backgroundColor="rgba(255,255,255,0.03)"
            >
              <Text fontWeight="700" textTransform="capitalize">
                {day.date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}
              </Text>
              <Paragraph margin={0} color="$muted" size="$2">
                Tareas: {day.taskCount}
              </Paragraph>
              <Paragraph margin={0} color="$muted" size="$2">
                Horas estimadas: {formatHours(day.totalEstimatedMinutes)}
              </Paragraph>
              <Text color="$accent">{indicator(day.taskCount)}</Text>
            </YStack>
          ))}
        </XStack>
      </YStack>
    </AppCard>
  );
}
